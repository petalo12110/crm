import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken }               from '../../core/utils'
import { UnauthorizedError }               from '../../core/errors'
import { prisma }                          from '../../infrastructure/database/prisma'
import { cache, CacheService }             from '../../infrastructure/cache/CacheService'

export async function authenticate(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header')
    }

    const token   = header.slice(7)
    const payload = verifyAccessToken(token)

    if (payload.role === 'SUPER_ADMIN') {
      await authenticateSuperAdmin(req, payload)
      return next()
    }

    // Keyed by both user and company: a user's role/permissions can differ
    // per company, so caching by userId alone could serve one company's
    // cached role/data to a request authenticated for a different company.
    const cacheKey   = CacheService.key('user', payload.sub, payload.companyId ?? '')
    const cachedUser = await cache.get<Express.Request['user']>(cacheKey)

    if (cachedUser) {
      req.user      = cachedUser
      req.companyId = payload.companyId
      return next()
    }

    const [user, member] = await Promise.all([
      prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, isActive: true },
      }),
      prisma.companyMember.findFirst({
        where: { userId: payload.sub, companyId: payload.companyId ?? undefined, isActive: true },
        select:{ role: true },
      }),
    ])

    if (!user)   throw new UnauthorizedError('User not found or inactive')
    if (!member) throw new UnauthorizedError('Not a member of this company')

    const authUser: Express.Request['user'] = {
      id:        user.id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      member.role,
      companyId: payload.companyId,
      avatarUrl: user.avatarUrl,
    }

    await cache.set(cacheKey, authUser, 300)
    req.user      = authUser
    req.companyId = payload.companyId
    next()
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token expired'))
    }
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid access token'))
    }
    next(err)
  }
}

/**
 * Super Admin tokens carry no companyId at all — they're platform-level,
 * not scoped to a company membership. Still re-verified against the DB on
 * every request (via a short-lived cache, same as the company-member path)
 * rather than trusting the token's role claim forever, so revoking
 * isSuperAdmin takes effect within the cache TTL instead of only at the
 * token's natural expiry.
 */
async function authenticateSuperAdmin(
  req: Request,
  payload: { sub: string }
): Promise<void> {
  const cacheKey   = CacheService.key('superadmin', payload.sub)
  const cachedUser = await cache.get<Express.Request['user']>(cacheKey)

  if (cachedUser) {
    req.user      = cachedUser
    req.companyId = null
    return
  }

  const user = await prisma.user.findFirst({
    where:  { id: payload.sub, isActive: true, deletedAt: null, isSuperAdmin: true },
    select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
  })
  if (!user) throw new UnauthorizedError('Not an active Super Admin account')

  const authUser: Express.Request['user'] = {
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    role: 'SUPER_ADMIN', companyId: null, avatarUrl: user.avatarUrl,
  }

  await cache.set(cacheKey, authUser, 300)
  req.user      = authUser
  req.companyId = null
}
