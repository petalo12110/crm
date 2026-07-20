import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingState } from '@/components/ui/States'

/**
 * Guards the /admin/* tree. Deliberately separate from ProtectedRoute
 * (the company-CRM guard) rather than a shared component with a role
 * check bolted on — a Super Admin session and a company session are
 * different audiences with different login pages, and mixing the guards
 * would make it easy to accidentally leak one tree's access into the
 * other.
 */
export function AdminProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState />
  if (!isAuthenticated || user?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
