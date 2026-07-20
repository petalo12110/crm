import { Request, Response, NextFunction } from 'express'
import { verifyPortalToken }               from '../../core/utils'
import { UnauthorizedError }               from '../../core/errors'
import { prisma }                          from '../../infrastructure/database/prisma'

export interface PortalCustomer {
  id:        string
  companyId: string
  email:     string | null
  firstName: string | null
  lastName:  string | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      portalCustomer?: PortalCustomer
    }
  }
}

/**
 * Guards /portal/* routes. Completely separate from authenticate.ts
 * (employee/Super Admin) — a portal token can't be accepted here by
 * accident because verifyPortalToken enforces a distinct JWT audience
 * claim, and even with a valid token this always re-verifies the
 * customer record still exists and isn't soft-deleted, scoping every
 * subsequent query to req.portalCustomer.id / .companyId.
 */
export async function authenticatePortal(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header')
    }

    const payload = verifyPortalToken(header.slice(7))

    const customer = await prisma.customer.findFirst({
      where:  { id: payload.sub, companyId: payload.companyId, deletedAt: null },
      select: { id: true, companyId: true, email: true, firstName: true, lastName: true },
    })
    if (!customer) throw new UnauthorizedError('Portal session no longer valid')

    req.portalCustomer = customer
    next()
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Session expired — please request a new login link'))
    }
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid session'))
    }
    next(err)
  }
}
