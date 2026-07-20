import { Outlet, Link } from 'react-router-dom'
import { LifeBuoy, LogOut } from 'lucide-react'
import { usePortalAuth } from '@/context/PortalAuthContext'

export function PortalLayout() {
  const { customer, company, logout } = usePortalAuth()

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5">
        <Link to={`/portal/${company?.slug}/tickets`} className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <span className="font-semibold text-text-primary">{company?.name} Support</span>
        </Link>
        <div className="flex items-center gap-3">
          {customer && (
            <span className="hidden text-sm text-text-secondary sm:inline">
              {customer.firstName} {customer.lastName}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
