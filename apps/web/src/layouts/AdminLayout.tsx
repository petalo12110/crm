import { Outlet, Link } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Badge'

/**
 * Standalone shell for the Super Admin area — same light, token-based
 * look as the tenant CRM's Topbar (not a separate dark theme), just with
 * no Sidebar and a "Super Admin" tag next to the mark. Super Admins only
 * manage companies and platform settings, so they get a plain top bar
 * instead of a mostly-empty copy of the tenant nav.
 */
export function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5 md:h-16">
        <Link to="/admin" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-text-primary text-sm font-bold text-surface">C</div>
          <div>
            <p className="text-sm font-semibold leading-tight text-text-primary">CRM Platform</p>
            <p className="flex items-center gap-1 text-xs font-medium leading-tight text-text-muted">
              <ShieldCheck className="h-3 w-3" /> Super Admin
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
              <span className="text-sm font-medium text-text-primary">{user.firstName} {user.lastName}</span>
            </div>
          )}
          <button
            onClick={() => logout()}
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
