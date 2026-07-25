import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingState } from '@/components/ui/States'

/**
 * The inverse of ProtectedRoute — guards pages that only make sense for a
 * logged-out visitor (the login forms specifically). Without this,
 * opening /login or /admin/login in a new tab while already
 * authenticated would show the form as if nothing were logged in, and
 * submitting it would silently replace the existing session's tokens in
 * localStorage — logging the original session out from under you with no
 * warning, before you ever chose to log out.
 *
 * Deliberately not applied to /forgot-password or /reset-password — those
 * are token-scoped actions (e.g. resetting a colleague's password via a
 * link) that should work regardless of whatever session happens to be
 * active in the browser, not "login" forms competing for the same slot.
 */
export function GuestRoute() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return <LoadingState />

  if (isAuthenticated) {
    // Send them to wherever their existing session actually belongs,
    // regardless of which login page they landed on.
    return <Navigate to={user?.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard'} replace />
  }

  return <Outlet />
}
