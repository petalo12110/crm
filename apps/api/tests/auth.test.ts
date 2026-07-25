import './helpers/prismaMock'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService }        from '../src/modules/auth/auth.service'
import { UnauthorizedError }  from '../src/core/errors/index'
import { ForbiddenError }     from '../src/core/errors/index'
import { BusinessRuleError }  from '../src/core/errors/index'

// ── Mocks ──────────────────────────────────────────────────

const mockRepo = {
  findUserByEmail:          vi.fn(),
  findUserById:             vi.fn(),
  incrementFailedLogins:    vi.fn(),
  lockAccount:              vi.fn(),
  resetFailedLogins:        vi.fn(),
  storeRefreshToken:        vi.fn(),
  findRefreshToken:         vi.fn(),
  revokeRefreshToken:       vi.fn(),
  revokeTokenFamily:        vi.fn(),
  revokeAllUserTokens:      vi.fn(),
  storePasswordResetToken:  vi.fn(),
  findPasswordResetToken:   vi.fn(),
  markResetTokenUsed:       vi.fn(),
  updatePassword:           vi.fn(),
  updateProfile:            vi.fn(),
  getUserMembership:        vi.fn(),
}

const mockAudit = { log: vi.fn() }

// Patch bcryptjs so tests don't slow down with real hashing
vi.mock('bcryptjs', () => ({
  default: {
    hash:    vi.fn(async (pw: string) => `hashed:${pw}`),
    compare: vi.fn(async (pw: string, hash: string) => hash === `hashed:${pw}`),
  },
}))

// Patch JWT signing
vi.mock('jsonwebtoken', () => ({
  default: {
    sign:   vi.fn(() => 'mock.access.token'),
    verify: vi.fn((token: string) => {
      if (token === 'expired') throw Object.assign(new Error('expired'), { name: 'TokenExpiredError' })
      if (token === 'invalid') throw Object.assign(new Error('invalid'), { name: 'JsonWebTokenError' })
      return { sub: 'user-1', companyId: 'company-1', role: 'MANAGER', email: 'test@test.com' }
    }),
  },
}))

// Stub queue service to prevent Redis connection
vi.mock('../src/infrastructure/queue/queues', () => ({
  emailQueue:        { add: vi.fn() },
  notificationQueue: { add: vi.fn() },
  reportQueue:       { add: vi.fn() },
  cleanupQueue:      { add: vi.fn() },
}))
vi.mock('../src/infrastructure/queue/QueueService', () => ({
  queueService: { sendEmail: vi.fn().mockResolvedValue(undefined) },
}))

// Stub cache to be a no-op
vi.mock('../../src/infrastructure/cache/CacheService', () => ({
  cache: { get: vi.fn(() => null), set: vi.fn(), delete: vi.fn() },
  CacheService: { key: (...parts: string[]) => parts.join(':') },
}))

// ── Tests ──────────────────────────────────────────────────

const COMPANY_ID  = 'company-1'
const VALID_HASH  = 'hashed:Password@1'

const makeUser = (overrides = {}) => ({
  id:               'user-1',
  email:            'test@acme.com',
  passwordHash:     VALID_HASH,
  isActive:         true,
  failedLoginCount: 0,
  lockedUntil:      null,
  firstName:        'Test',
  lastName:         'User',
  avatarUrl:        null,
  ...overrides,
})

const makeMembership = (overrides = {}) => ({
  companyId:  COMPANY_ID,
  userId:     'user-1',
  role:       'MANAGER',
  isActive:   true,
  company: { id: COMPANY_ID, name: 'Acme', slug: 'acme', timezone: 'UTC', currency: 'USD' },
  ...overrides,
})

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AuthService(mockRepo as never, mockAudit as never)
    mockRepo.storeRefreshToken.mockResolvedValue(undefined)
    mockRepo.resetFailedLogins.mockResolvedValue(undefined)
    mockRepo.revokeRefreshToken.mockResolvedValue(undefined)
    mockAudit.log.mockResolvedValue(undefined)
  })

  // ── Login ────────────────────────────────────────────────

  describe('login()', () => {
    it('returns tokens and user data on valid credentials', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(makeUser())
      mockRepo.getUserMembership.mockResolvedValue(makeMembership())

      const result = await service.login(
        { email: 'test@acme.com', password: 'Password@1', rememberMe: false },
        { ipAddress: '127.0.0.1' },
        COMPANY_ID
      )

      expect(result).toMatchObject({
        accessToken:  'mock.access.token',
        expiresIn:    expect.any(Number),
        user: expect.objectContaining({ email: 'test@acme.com', role: 'MANAGER' }),
      })
      expect(result.refreshToken).toBeTruthy()
    })

    it('throws UnauthorizedError for unknown email', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(null)
      await expect(
        service.login({ email: 'nobody@x.com', password: 'whatever', rememberMe: false }, {}, COMPANY_ID)
      ).rejects.toThrow(UnauthorizedError)
    })

    it('throws UnauthorizedError for wrong password', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(makeUser())
      mockRepo.incrementFailedLogins.mockResolvedValue(1)

      await expect(
        service.login({ email: 'test@acme.com', password: 'WrongPass@1', rememberMe: false }, {}, COMPANY_ID)
      ).rejects.toThrow(UnauthorizedError)

      expect(mockRepo.incrementFailedLogins).toHaveBeenCalledWith('user-1')
    })

    it('locks account after max failed attempts', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(makeUser())
      mockRepo.incrementFailedLogins.mockResolvedValue(5)
      mockRepo.lockAccount.mockResolvedValue(undefined)

      await expect(
        service.login({ email: 'test@acme.com', password: 'WrongPass@1', rememberMe: false }, {}, COMPANY_ID)
      ).rejects.toThrow(ForbiddenError)

      expect(mockRepo.lockAccount).toHaveBeenCalledWith('user-1', expect.any(Date))
    })

    it('throws ForbiddenError when account is locked', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(
        makeUser({ lockedUntil: new Date(Date.now() + 10 * 60_000) })
      )

      await expect(
        service.login({ email: 'test@acme.com', password: 'Password@1', rememberMe: false }, {}, COMPANY_ID)
      ).rejects.toThrow(ForbiddenError)
    })

    it('throws ForbiddenError when not a company member', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(makeUser())
      mockRepo.getUserMembership.mockResolvedValue(null)

      await expect(
        service.login({ email: 'test@acme.com', password: 'Password@1', rememberMe: false }, {}, COMPANY_ID)
      ).rejects.toThrow(ForbiddenError)
    })

    it('writes audit log on successful login', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(makeUser())
      mockRepo.getUserMembership.mockResolvedValue(makeMembership())

      await service.login(
        { email: 'test@acme.com', password: 'Password@1', rememberMe: false },
        { ipAddress: '10.0.0.1' },
        COMPANY_ID
      )

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN', userId: 'user-1', companyId: COMPANY_ID })
      )
    })
  })

  // ── Refresh ──────────────────────────────────────────────

  describe('refresh()', () => {
    it('throws UnauthorizedError for unknown refresh token', async () => {
      mockRepo.findRefreshToken.mockResolvedValue(null)
      await expect(
        service.refresh({ refreshToken: 'bad-token' }, {})
      ).rejects.toThrow(UnauthorizedError)
    })

    it('throws UnauthorizedError and revokes family on reused token', async () => {
      mockRepo.findRefreshToken.mockResolvedValue({
        tokenHash:  'hash',
        familyId:   'family-1',
        revokedAt:  new Date(),   // already revoked — reuse detected
        expiresAt:  new Date(Date.now() + 60_000),
        userId:     'user-1',
      })
      mockRepo.revokeTokenFamily.mockResolvedValue(undefined)

      await expect(
        service.refresh({ refreshToken: 'reused-token' }, {})
      ).rejects.toThrow(UnauthorizedError)

      expect(mockRepo.revokeTokenFamily).toHaveBeenCalledWith('family-1')
    })

    it('throws UnauthorizedError for expired refresh token', async () => {
      mockRepo.findRefreshToken.mockResolvedValue({
        tokenHash:  'hash',
        familyId:   'family-1',
        revokedAt:  null,
        expiresAt:  new Date(Date.now() - 1000), // expired
        userId:     'user-1',
      })

      await expect(
        service.refresh({ refreshToken: 'expired-token' }, {})
      ).rejects.toThrow(UnauthorizedError)
    })
  })

  // ── Forgot / Reset password ──────────────────────────────

  describe('forgotPassword()', () => {
    it('silently succeeds for unknown email (no user enumeration)', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(null)
      await expect(
        service.forgotPassword({ email: 'nobody@x.com' })
      ).resolves.toBeUndefined()
    })

    it('stores reset token and enqueues email for valid user', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(makeUser())
      mockRepo.storePasswordResetToken.mockResolvedValue(undefined)

      await service.forgotPassword({ email: 'test@acme.com' })

      expect(mockRepo.storePasswordResetToken).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),  // token hash
        expect.any(Date)     // expiry
      )
    })
  })

  describe('resetPassword()', () => {
    it('throws BusinessRuleError for invalid/expired token', async () => {
      mockRepo.findPasswordResetToken.mockResolvedValue(null)
      await expect(
        service.resetPassword({ token: 'bad', password: 'NewPass@99' })
      ).rejects.toThrow(BusinessRuleError)
    })

    it('updates password and revokes all tokens on success', async () => {
      mockRepo.findPasswordResetToken.mockResolvedValue({
        id:      'reset-1',
        userId:  'user-1',
        usedAt:  null,
        expiresAt: new Date(Date.now() + 60_000),
      })
      mockRepo.updatePassword.mockResolvedValue(undefined)
      mockRepo.markResetTokenUsed.mockResolvedValue(undefined)
      mockRepo.revokeAllUserTokens.mockResolvedValue(undefined)

      await service.resetPassword({ token: 'valid-token', password: 'NewPass@99' })

      expect(mockRepo.updatePassword).toHaveBeenCalledWith('user-1', expect.stringContaining('hashed:'))
      expect(mockRepo.revokeAllUserTokens).toHaveBeenCalledWith('user-1')
      expect(mockRepo.markResetTokenUsed).toHaveBeenCalledWith('reset-1')
    })
  })

  // ── Logout ───────────────────────────────────────────────

  describe('logout()', () => {
    it('revokes refresh token and writes audit log', async () => {
      await service.logout('some-refresh-token', 'user-1', COMPANY_ID)
      expect(mockRepo.revokeRefreshToken).toHaveBeenCalled()
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT' })
      )
    })
  })
})
