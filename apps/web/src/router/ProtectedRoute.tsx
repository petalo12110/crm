import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingState } from '@/components/ui/States'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  // A Super Admin has no companyId and isn't a company member — none of
  // the regular CRM pages (customers, leads, etc.) can work for them, so
  // send them to their own area instead of letting them hit broken pages.
  if (user?.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />

  return <Outlet />
}
