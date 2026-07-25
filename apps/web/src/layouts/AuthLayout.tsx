import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-lg font-bold text-white">C</div>
          <span className="text-lg font-semibold text-text-primary">CRM Platform</span>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-raised">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
