import * as crypto          from 'crypto'
import { AuthRepository }   from './auth.repository'
import { AuditService }     from '../audit/audit.service'
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateSecureToken,
  hashToken,
} from '../../core/utils'
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} from '../../core/errors'
import { config }           from '../../config/env'
import { cache, CacheService } from '../../infrastructure/cache/CacheService'
import { queueService }    from '../../infrastructure/queue/QueueService'
import type {
  LoginInput,
  RefreshInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from '@crm/shared'

export class AuthService {
  constructor(
    private readonly repo:  AuthRepository,
    private readonly audit: AuditService,
  ) {}

  // ── Login ────────────────────────────────────────────────

  // ── Shared credential verification ────────────────────────
  //
  // Used by both login() and adminLogin() so the timing-attack mitigation,
  // lockout logic, and failed-attempt tracking can't drift between the two
  // entry points.
  private async verifyCredentialsOrThrow(email: string, password: string) {
    const user = await this.repo.findUserByEmail(email)

    // Use constant-time comparison pattern — always hash even if user not found
    if (!user) {
      await verifyPassword('dummy', '$2a$12$dummyhashtopreventtimingattacks00000000000')
      throw new UnauthorizedError('Invalid email or password')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
      throw new ForbiddenError(
        `Account is locked. Try again in ${Math.ceil(seconds / 60)} minutes.`
      )
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      const attempts = await this.repo.incrementFailedLogins(user.id)
      if (attempts >= config.MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + config.LOCKOUT_MINUTES * 60_000)
        await this.repo.lockAccount(user.id, lockUntil)
        throw new ForbiddenError(
          `Too many failed attempts. Account locked for ${config.LOCKOUT_MINUTES} minutes.`
        )
      }
      throw new UnauthorizedError('Invalid email or password')
    }

    await this.repo.resetFailedLogins(user.id)
    return user
  }

  // ── Login (company members) ───────────────────────────────

  async login(
    dto:       LoginInput,
    meta:      { ipAddress?: string; userAgent?: string },
    companyId: string
  ) {
    const user = await this.verifyCredentialsOrThrow(dto.email, dto.password)

    // Verify membership in the requested company
    const membership = await this.repo.getUserMembership(user.id, companyId)
    if (!membership || !membership.isActive) {
      throw new ForbiddenError('You are not a member of this company')
    }

    const tokens = await this.issueTokenPair(
      user.id, companyId, membership.role, user.email, meta
    )

    await this.audit.log({
      companyId,
      userId:    user.id,
      action:    'LOGIN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn:    config.ACCESS_TOKEN_TTL,
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      membership.role,
        companyId,
        avatarUrl: user.avatarUrl,
        company:   membership.company,
      },
    }
  }

  // ── Login (platform Super Admin) ──────────────────────────
  //
  // Deliberately separate from login() rather than a flag on the same
  // method — a Super Admin isn't a company member, takes no companyId,
  // and the resulting token carries companyId: null / role: SUPER_ADMIN.
  // This is the only login path the /admin/login page ever calls.
  async adminLogin(dto: LoginInput, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.verifyCredentialsOrThrow(dto.email, dto.password)

    if (!user.isSuperAdmin) {
      // Same message as a bad password — don't reveal that this account
      // exists but isn't a Super Admin.
      throw new UnauthorizedError('Invalid email or password')
    }

    const tokens = await this.issueTokenPair(user.id, null, 'SUPER_ADMIN', user.email, meta)

    await this.audit.log({
      userId:    user.id,
      action:    'LOGIN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn:    config.ACCESS_TOKEN_TTL,
      user: {
        id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
        role: 'SUPER_ADMIN', companyId: null, avatarUrl: user.avatarUrl,
      },
    }
  }

  // ── Refresh ──────────────────────────────────────────────

  async refresh(dto: RefreshInput, meta: { ipAddress?: string; userAgent?: string }) {
    const tokenHash  = hashToken(dto.refreshToken)
    const storedToken = await this.repo.findRefreshToken(tokenHash)

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token')
    }

    // Detect token reuse — revoke entire family (breach response)
    if (storedToken.revokedAt) {
      await this.repo.revokeTokenFamily(storedToken.familyId)
      throw new UnauthorizedError(
        'Refresh token already used. All sessions have been revoked for security.'
      )
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired')
    }

    // Revoke the used token
    await this.repo.revokeRefreshToken(tokenHash)

    // Load user and membership
    const user = await this.repo.findUserById(storedToken.userId)
    if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive')

    if (user.isSuperAdmin) {
      const tokens = await this.issueTokenPair(
        user.id, null, 'SUPER_ADMIN', user.email, meta, storedToken.familyId
      )
      return {
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn:    config.ACCESS_TOKEN_TTL,
      }
    }

    // We need companyId — store it on the refresh token (add to schema) or extract from JWT claim
    // For now resolve via active membership (picks the first active one if multi-company)
    // A better approach: encode companyId in the refresh token at creation (done via DB field below)
    const member = await prisma_findFirstMember(user.id)
    if (!member) throw new UnauthorizedError('No active company membership')

    const tokens = await this.issueTokenPair(
      user.id, member.companyId, member.role, user.email, meta, storedToken.familyId
    )

    return {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn:    config.ACCESS_TOKEN_TTL,
    }
  }

  // ── Logout ───────────────────────────────────────────────

  async logout(refreshToken: string, userId: string, companyId: string | null): Promise<void> {
    const tokenHash = hashToken(refreshToken)
    await this.repo.revokeRefreshToken(tokenHash)
    // Cache keys are now per-company (user:<id>:<companyId>), so we clear
    // every company-scoped entry for this user rather than a single key.
    await cache.invalidatePattern(CacheService.key('user', userId, '*'))
    await cache.delete(CacheService.key('superadmin', userId)) // no-op unless this user is a Super Admin
    await this.audit.log({ companyId, userId, action: 'LOGOUT' })
  }

  async logoutAll(userId: string, companyId: string | null): Promise<void> {
    await this.repo.revokeAllUserTokens(userId)
    await cache.invalidatePattern(CacheService.key('user', userId, '*'))
    await cache.delete(CacheService.key('superadmin', userId)) // no-op unless this user is a Super Admin
    await this.audit.log({ companyId, userId, action: 'LOGOUT' })
  }

  // ── Forgot password ──────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordInput): Promise<void> {
    const user = await this.repo.findUserByEmail(dto.email)
    // Always respond success — don't reveal whether email exists
    if (!user) return

    const rawToken  = generateSecureToken(32)
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60_000) // 1 hour

    await this.repo.storePasswordResetToken(user.id, tokenHash, expiresAt)

    await queueService.sendEmail({
      to:       user.email,
      subject:  'Reset your password',
      template: 'password-reset',
      context: {
        firstName: user.firstName,
        resetUrl: `${config.FRONTEND_URL}/reset-password?token=${rawToken}`,
      },
    })
  }

  // ── Welcome email (new employee invite) ──────────────────

  /**
   * Sends a "set your password" link to a newly-created user, reusing the
   * same password-reset-token mechanism as forgotPassword(). The caller
   * (companies.routes.ts invite endpoint) is responsible for having
   * already created the user with an unguessable, never-revealed random
   * password — this just gives them a real way to set their own.
   *
   * Only call this for brand-new users. If an existing user is being
   * added to an additional company, their password should be untouched.
   */
  async sendWelcomeEmail(
    user: { id: string; email: string; firstName: string },
    companyName: string
  ): Promise<void> {
    const rawToken     = generateSecureToken(32)
    const tokenHash     = hashToken(rawToken)
    const expiresInHours = 168 // 7 days — invites sit unread longer than password resets
    const expiresAt      = new Date(Date.now() + expiresInHours * 60 * 60_000)

    await this.repo.storePasswordResetToken(user.id, tokenHash, expiresAt)

    await queueService.sendEmail({
      to:       user.email,
      subject:  `You've been added to ${companyName}`,
      template: 'welcome',
      context: {
        firstName:      user.firstName,
        companyName,
        expiresInHours,
        setPasswordUrl: `${config.FRONTEND_URL}/reset-password?token=${rawToken}`,
      },
    })
  }

  // ── Reset password ───────────────────────────────────────

  async resetPassword(dto: ResetPasswordInput): Promise<void> {
    const tokenHash  = hashToken(dto.token)
    const resetToken = await this.repo.findPasswordResetToken(tokenHash)

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BusinessRuleError('Password reset link is invalid or has expired')
    }

    const passwordHash = await hashPassword(dto.password)
    await Promise.all([
      this.repo.updatePassword(resetToken.userId, passwordHash),
      this.repo.markResetTokenUsed(resetToken.id),
      this.repo.revokeAllUserTokens(resetToken.userId),
    ])

    await this.audit.log({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET',
    })
  }

  // ── Change password (authenticated) ─────────────────────

  async changePassword(userId: string, companyId: string | null, dto: ChangePasswordInput): Promise<void> {
    const user = await this.repo.findUserById(userId)
    if (!user) throw new NotFoundError('User not found')

    const valid = await verifyPassword(dto.currentPassword, user.passwordHash)
    if (!valid) throw new BusinessRuleError('Current password is incorrect')

    const passwordHash = await hashPassword(dto.newPassword)
    await this.repo.updatePassword(userId, passwordHash)
    await this.repo.revokeAllUserTokens(userId)
    await cache.invalidatePattern(CacheService.key('user', userId, '*'))
    await cache.delete(CacheService.key('superadmin', userId)) // no-op unless this user is a Super Admin

    await this.audit.log({ companyId, userId, action: 'PASSWORD_RESET' })
  }

  // ── Update profile ───────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileInput) {
    await this.repo.updateProfile(userId, dto)
    // Profile fields (name/avatar) are shared across every company this
    // user belongs to, so invalidate all of that user's cached entries.
    await cache.invalidatePattern(CacheService.key('user', userId, '*'))
    await cache.delete(CacheService.key('superadmin', userId)) // no-op unless this user is a Super Admin
    return this.repo.findUserById(userId)
  }

  // ── Private helpers ──────────────────────────────────────

  private async issueTokenPair(
    userId:    string,
    companyId: string | null,
    role:      string,
    email:     string,
    meta:      { ipAddress?: string; userAgent?: string },
    existingFamilyId?: string
  ) {
    const accessToken  = signAccessToken({ sub: userId, companyId, role, email })
    const rawRefresh   = generateSecureToken(40)
    const tokenHash    = hashToken(rawRefresh)
    const familyId     = existingFamilyId ?? crypto.randomUUID()
    const expiresAt    = new Date(Date.now() + config.REFRESH_TOKEN_TTL * 1000)

    await this.repo.storeRefreshToken({
      userId,
      tokenHash,
      familyId,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    })

    return { accessToken, refreshToken: rawRefresh }
  }
}

// Inline helper to avoid circular dependency with prisma module
import { prisma } from '../../infrastructure/database/prisma'
async function prisma_findFirstMember(userId: string) {
  return prisma.companyMember.findFirst({
    where:  { userId, isActive: true },
    select: { companyId: true, role: true },
  })
}
