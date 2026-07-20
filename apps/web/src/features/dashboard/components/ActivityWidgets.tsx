import { Avatar } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/States'
import { formatCurrency, formatRelativeTime, formatFullName } from '@/lib/formatters'
import { useTopPerformers, useRecentActivity } from '../hooks/useDashboard'

export function TopPerformersTable() {
  const { data, isLoading } = useTopPerformers()

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Top Performers this month</h3>
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {(data ?? []).length === 0 && (
            <p className="text-sm text-text-secondary">No data yet this month.</p>
          )}
          {(data ?? []).map((p: Record<string, unknown>, i: number) => {
            const emp = p.employee as { firstName: string; lastName: string } | null
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-text-muted">{i + 1}</span>
                <Avatar firstName={emp?.firstName} lastName={emp?.lastName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {emp ? formatFullName(emp.firstName, emp.lastName) : 'Unknown'}
                  </p>
                  <p className="text-xs text-text-secondary">{p.dealsWon as number} deals won</p>
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {formatCurrency(p.revenueGenerated as number)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'created', UPDATE: 'updated', DELETE: 'deleted',
  LOGIN: 'logged in', LOGOUT: 'logged out', FILE_UPLOAD: 'uploaded file',
  SETTINGS_CHANGE: 'changed settings',
}

export function RecentActivityFeed() {
  const { data, isLoading } = useRecentActivity()

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Recent Activity</h3>
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {(data ?? []).slice(0, 8).map((log: Record<string, unknown>) => {
            const user = log.user as { firstName: string; lastName: string } | null
            return (
              <div key={log.id as string} className="flex items-start gap-2.5">
                <Avatar firstName={user?.firstName} lastName={user?.lastName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">
                      {user ? formatFullName(user.firstName, user.lastName) : 'System'}
                    </span>{' '}
                    {ACTION_LABELS[log.action as string] ?? log.action as string}{' '}
                    <span className="text-text-secondary">{log.entityType as string}</span>
                  </p>
                  <p className="text-xs text-text-muted">{formatRelativeTime(log.occurredAt as string)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
