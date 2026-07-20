import { Outlet } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

/**
 * Same visual language as AuthLayout (light, token-based — consistent
 * with the rest of the app and its light/dark toggle) rather than a
 * hardcoded dark theme. The distinction from the tenant login is a
 * small "Super Admin" tag next to the mark, not a different color system.
 */
export function AdminAuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-text-primary text-lg font-bold text-surface">C</div>
          <div>
            <p className="text-sm font-semibold leading-tight text-text-primary">CRM Platform</p>
            <p className="flex items-center gap-1 text-xs font-medium leading-tight text-text-muted">
              <ShieldCheck className="h-3 w-3" /> Super Admin
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-raised">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
