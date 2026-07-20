import { useAuth } from '@/context/AuthContext'

const ROLE_GROUPS: Record<string, string[]> = {
  ALL:        ['SUPER_ADMIN','COMPANY_OWNER','MANAGER','SALES_REP','SUPPORT','EMPLOYEE'],
  MANAGEMENT: ['SUPER_ADMIN','COMPANY_OWNER','MANAGER'],
  SALES:      ['SUPER_ADMIN','COMPANY_OWNER','MANAGER','SALES_REP'],
  SUPPORT:    ['SUPER_ADMIN','COMPANY_OWNER','MANAGER','SUPPORT'],
  OWNER_ONLY: ['SUPER_ADMIN','COMPANY_OWNER'],
  SUPER_ONLY: ['SUPER_ADMIN'],
}

/**
 * Plain (non-hook) permission check — safe to call inside loops/.map()/.some()
 * where calling a hook would risk violating the rules of hooks. Use this
 * whenever you already have the role in hand from a single useAuth() call.
 */
export function checkPermission(role: string | undefined | null, allowed: string | string[]): boolean {
  if (!role) return false
  if (role === 'SUPER_ADMIN') return true

  const roles = typeof allowed === 'string' ? ROLE_GROUPS[allowed] ?? [allowed] : allowed
  return roles.includes(role)
}

/** Checks whether the current user's role is in the given group or explicit role list */
export function usePermission(allowed: string | string[]): boolean {
  const { user } = useAuth()
  return checkPermission(user?.role, allowed)
}
