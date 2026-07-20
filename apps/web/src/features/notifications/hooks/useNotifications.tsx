import { api } from '@/lib/axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check } from 'lucide-react'
import { formatRelativeTime } from '@/lib/formatters'

// ── API ───────────────────────────────────────────────────

const notifApi = {
  list: () => api.get('/notifications?limit=30').then(r => r.data),
  getUnreadCount: () => api.get('/notifications/unread-count').then(r => r.data.data.count as number),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

const KEY = 'notifications'

export function useNotifications() {
  return useQuery({ queryKey: [KEY, 'list'], queryFn: notifApi.list, refetchInterval: 30_000 })
}

export function useNotificationsCount() {
  return useQuery({ queryKey: [KEY, 'count'], queryFn: notifApi.getUnreadCount, refetchInterval: 30_000 })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notifApi.markRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notifApi.markAllRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Panel component ───────────────────────────────────────

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useNotifications()
  const markRead    = useMarkRead()
  const markAllRead = useMarkAllRead()

  const notifications = data?.data ?? []

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-4 top-16 z-50 w-96 rounded-lg border border-border bg-surface shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-text-secondary" />
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
          </div>
          <button
            onClick={() => markAllRead.mutate()}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Check className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>

        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-sm text-text-secondary">Loading…</div>
          )}
          {!isLoading && notifications.length === 0 && (
            <div className="p-8 text-center text-sm text-text-secondary">All caught up!</div>
          )}
          {notifications.map((n: Record<string, unknown>) => (
            <div
              key={n.id as string}
              onClick={() => !(n.isRead as boolean) && markRead.mutate(n.id as string)}
              className={`flex cursor-pointer gap-3 px-4 py-3 hover:bg-surface-2 ${!(n.isRead as boolean) ? 'bg-primary/5' : ''}`}
            >
              {!(n.isRead as boolean) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              {!!(n.isRead as boolean) && <span className="mt-1.5 h-2 w-2 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{n.title as string}</p>
                {!!(n.body as string) && <p className="text-xs text-text-secondary line-clamp-2">{String(n.body)}</p>}
                <p className="mt-0.5 text-xs text-text-muted">{formatRelativeTime(n.createdAt as string)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
