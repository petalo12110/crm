import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/States'
import { formatRelativeTime } from '@/lib/formatters'
import { AlertTriangle } from 'lucide-react'

interface Ticket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  slaDeadline: string | null
  slaBreached: boolean
  customer: { firstName: string; lastName: string; companyName: string | null } | null
  assignee: { firstName: string; lastName: string } | null
  createdAt: string
}

const PRIORITY_BORDER: Record<string, string> = {
  LOW:      'border-l-surface-3',
  MEDIUM:   'border-l-primary',
  HIGH:     'border-l-warning',
  CRITICAL: 'border-l-danger',
  URGENT:   'border-l-danger',
}

export function TicketTable({ tickets, isLoading }: { tickets: Ticket[]; isLoading: boolean }) {
  if (isLoading) return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <TableSkeleton rows={5} cols={4} />
    </div>
  )

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {tickets.map(t => (
          <Link
            key={t.id}
            to={`/tickets/${t.id}`}
            className={`block rounded-lg border border-l-4 border-border bg-surface p-3
              hover:bg-surface-2 ${PRIORITY_BORDER[t.priority] ?? 'border-l-border'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">{t.title}</p>
                <p className="text-xs text-text-muted">{t.ticketNumber}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge status={t.status}>{t.status}</Badge>
                <Badge status={t.priority}>{t.priority}</Badge>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
              <span>
                {t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : 'No customer'}
              </span>
              <div className="flex items-center gap-1.5">
                {t.slaBreached && (
                  <span className="flex items-center gap-0.5 text-danger font-medium">
                    <AlertTriangle className="h-3 w-3" /> SLA
                  </span>
                )}
                <span>{formatRelativeTime(t.createdAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tickets.map(t => (
              <tr key={t.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link to={`/tickets/${t.id}`} className="block">
                    <p className="font-medium text-text-primary">{t.title}</p>
                    <p className="text-xs text-text-secondary">{t.ticketNumber}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : '—'}
                </td>
                <td className="px-4 py-3"><Badge status={t.priority}>{t.priority}</Badge></td>
                <td className="px-4 py-3"><Badge status={t.status}>{t.status}</Badge></td>
                <td className="px-4 py-3">
                  {t.slaBreached
                    ? <span className="flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle className="h-3.5 w-3.5"/>Breached</span>
                    : t.slaDeadline
                      ? <span className="text-xs text-text-secondary">{formatRelativeTime(t.slaDeadline)}</span>
                      : '—'
                  }
                </td>
                <td className="px-4 py-3 text-text-secondary">{formatRelativeTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
