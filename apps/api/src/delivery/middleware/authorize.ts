import { Request, Response, NextFunction, RequestHandler } from 'express'
import { ForbiddenError } from '../../core/errors'

/**
 * Factory that returns a middleware enforcing role-based access.
 * Pass the list of roles permitted to call the route.
 *
 * Note: SUPER_ADMIN no longer gets a blanket bypass here. Super Admins are
 * platform-level accounts, not members of any company, and are only meant
 * to touch company-management/platform-settings endpoints — they must be
 * explicitly listed in `allowedRoles` (see ROLES.SUPER_ONLY, or an inline
 * array like `[...ROLES.OWNER_ONLY, 'SUPER_ADMIN']` for the handful of
 * companies.routes.ts endpoints both audiences legitimately need). Regular
 * CRM routes (customers, leads, tickets, etc.) should never include
 * SUPER_ADMIN in their allowed list — a Super Admin token has no
 * companyId, so those handlers would break if it were let through anyway.
 *
 * Usage:  router.get('/customers', authenticate, authorize(['MANAGER','SALES_REP']), handler)
 */
export function authorize(allowedRoles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'))
    }

    const userRole = req.user.role

    if (!allowedRoles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Your role (${userRole}) does not have permission to perform this action`
        )
      )
    }

    next()
  }
}

// ── Pre-built role groups for convenience ──────────────────
//
// Deliberately do NOT include SUPER_ADMIN — see note above.
export const ROLES = {
  ALL:        ['COMPANY_OWNER','MANAGER','SALES_REP','SUPPORT','EMPLOYEE'],
  MANAGEMENT: ['COMPANY_OWNER','MANAGER'],
  SALES:      ['COMPANY_OWNER','MANAGER','SALES_REP'],
  SUPPORT:    ['COMPANY_OWNER','MANAGER','SUPPORT'],
  CAN_WRITE_CUSTOMERS: ['COMPANY_OWNER','MANAGER','SALES_REP'],
  CAN_DELETE:          ['COMPANY_OWNER','MANAGER'],
  OWNER_ONLY:          ['COMPANY_OWNER'],
  SUPER_ONLY:          ['SUPER_ADMIN'],
}
