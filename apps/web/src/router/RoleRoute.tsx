import { ReactNode } from 'react'
import { usePermission } from '@/hooks/usePermission'

export function RoleRoute({ allowed, children }: { allowed: string | string[]; children: ReactNode }) {
  const ok = usePermission(allowed)
  if (!ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-lg font-semibold text-text-primary">403 — Access denied</p>
        <p className="text-sm text-text-secondary">You don't have permission to view this page.</p>
      </div>
    )
  }
  return <>{children}</>
}
