import { Mail, Phone, MessageSquare, Users, Ticket as TicketIcon, GitCommit, FileText } from 'lucide-react'
import { formatRelativeTime } from '@/lib/formatters'
import { useCustomerTimeline } from '../hooks/useCustomers'
import { LoadingState, EmptyState } from '@/components/ui/States'

const ICONS: Record<string, React.ElementType> = {
  EMAIL: Mail, CALL: Phone, SMS: MessageSquare, MEETING: Users,
  TICKET: TicketIcon, STAGE_CHANGE: GitCommit, NOTE: FileText, SYSTEM: GitCommit,
}

export function CustomerTimeline({ customerId }: { customerId: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useCustomerTimeline(customerId)
  const entries = data?.pages.flatMap(p => p.data) ?? []

  if (isLoading) return <LoadingState />
  if (entries.length === 0) return <EmptyState title="No activity yet" description="Calls, emails, and notes will appear here." />

  return (
    <div className="space-y-1">
      {entries.map((entry: Record<string, unknown>) => {
        const Icon = ICONS[entry.entryType as string] ?? FileText
        const user = entry.user as { firstName: string; lastName: string } | null
        return (
          <div key={entry.id as string} className="flex gap-3 border-b border-border py-3 last:border-0">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3">
              <Icon className="h-3.5 w-3.5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-text-primary">{entry.subject as string}</p>
              {!!entry.body && <p className="mt-0.5 text-sm text-text-secondary">{entry.body as string}</p>}
              <p className="mt-0.5 text-xs text-text-muted">
                {user ? `${user.firstName} ${user.lastName} · ` : ''}{formatRelativeTime(entry.occurredAt as string)}
              </p>
            </div>
          </div>
        )
      })}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
