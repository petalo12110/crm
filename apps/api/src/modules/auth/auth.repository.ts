import { prisma }     from '../../infrastructure/database/prisma'
import { hashToken }  from '../../core/utils'

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    })
  }

  async findUserById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    })
  }

  async incrementFailedLogins(userId: string): Promise<number> {
    const user = await prisma.user.update({
      where: { id: userId },
      data:  { failedLoginCount: { increment: 1 } },
      select:{ failedLoginCount: true },
    })
    return user.failedLoginCount
  }

  async lockAccount(userId: string, until: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data:  { lockedUntil: until },
    })
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data:  { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    })
  }

  async storeRefreshToken(data: {
    userId:    string
    tokenHash: string
    familyId:  string
    expiresAt: Date
    userAgent?: string
    ipAddress?: string
  }): Promise<void> {
    await prisma.refreshToken.create({ data })
  }

  async findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } })
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data:  { revokedAt: new Date() },
    })
  }

  /** Revoke all tokens in a family — used when token reuse (breach) is detected */
  async revokeTokenFamily(familyId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
  }

  async storePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    // Invalidate any existing reset tokens for this user first
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data:  { usedAt: new Date() },
    })
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    })
  }

  async findPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  }

  async markResetTokenUsed(id: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { id },
      data:  { usedAt: new Date() },
    })
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data:  { passwordHash, failedLoginCount: 0, lockedUntil: null },
    })
  }

  async updateProfile(userId: string, data: Record<string, unknown>): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data })
  }

  async getUserMembership(userId: string, companyId: string) {
    return prisma.companyMember.findUnique({
      where:   { companyId_userId: { companyId, userId } },
      include: { company: { select: { id: true, name: true, slug: true, timezone: true, currency: true } } },
    })
  }
}
