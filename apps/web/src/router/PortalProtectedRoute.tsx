import { Navigate, Outlet, useParams } from 'react-router-dom'
import { usePortalAuth } from '@/context/PortalAuthContext'
import { LoadingState } from '@/components/ui/States'

export function PortalProtectedRoute() {
  const { isAuthenticated, isLoading, company } = usePortalAuth()
  const { companySlug } = useParams<{ companySlug: string }>()

  if (isLoading) return <LoadingState />

  if (!isAuthenticated) {
    return <Navigate to={`/portal/${companySlug ?? company?.slug ?? ''}/login`} replace />
  }

  return <Outlet />
}
