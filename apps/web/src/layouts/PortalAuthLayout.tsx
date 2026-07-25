import { Outlet } from 'react-router-dom'
import { usePortalAuth } from '@/context/PortalAuthContext'

/**
 * Shows the company's own name rather than "CRM Platform" branding —
 * customers are visiting *their* vendor's support portal, they shouldn't
 * see the name of the software vendor behind it.
 */
export function PortalAuthLayout() {
  const { company } = usePortalAuth()
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-lg font-semibold text-text-primary">{company?.name ?? 'Support Portal'}</p>
          <p className="text-xs uppercase tracking-wide text-text-muted">Customer Support Portal</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-raised">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
