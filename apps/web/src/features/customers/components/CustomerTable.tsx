import { Link } from 'react-router-dom'
import { MoreVertical, Trash2, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/States'
import { formatFullName, formatDate, getStatusColor } from '@/lib/formatters'

interface Customer {
  id: string
  firstName: string | null
  lastName:  string | null
  email:     string | null
  companyName: string | null
  status:    string
  customerType: string
  tags:      string[]
  assignee:  { id: string; firstName: string; lastName: string } | null
  createdAt: string
  _count?:   { leads: number; tickets: number }
}

export function CustomerTable({
  customers, isLoading, onDelete,
}: { customers: Customer[]; isLoading: boolean; onDelete: (id: string) => void }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  if (isLoading) return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <TableSkeleton rows={5} cols={4} />
    </div>
  )

  return (
    <>
      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {customers.map(c => (
          <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/customers/${c.id}`} className="flex items-center gap-2.5 min-w-0">
                <Avatar firstName={c.firstName} lastName={c.lastName} size="sm" />
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {formatFullName(c.firstName, c.lastName)}
                  </p>
                  <p className="text-xs text-text-secondary truncate">{c.email ?? '—'}</p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge status={c.status}>{c.status}</Badge>
                <button
                  onClick={() => setOpenMenu(o => o === c.id ? null : c.id)}
                  className="rounded p-1 text-text-muted hover:bg-surface-3"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
            {c.companyName && (
              <p className="mt-1.5 text-xs text-text-secondary">{c.companyName}</p>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
              <span>
                {c.assignee ? formatFullName(c.assignee.firstName, c.assignee.lastName) : 'Unassigned'}
              </span>
              <span>{formatDate(c.createdAt)}</span>
            </div>

            {openMenu === c.id && (
              <div className="mt-2 flex gap-2 border-t border-border pt-2">
                <Link
                  to={`/customers/${c.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md
                    border border-border py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-3"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View
                </Link>
                <button
                  onClick={() => { onDelete(c.id); setOpenMenu(null) }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md
                    border border-danger/30 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link to={`/customers/${c.id}`} className="flex items-center gap-2.5">
                    <Avatar firstName={c.firstName} lastName={c.lastName} size="sm" />
                    <div>
                      <p className="font-medium text-text-primary">{formatFullName(c.firstName, c.lastName)}</p>
                      <p className="text-xs text-text-secondary">{c.email ?? '—'}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-secondary">{c.companyName ?? '—'}</td>
                <td className="px-4 py-3"><Badge status={c.status}>{c.status}</Badge></td>
                <td className="px-4 py-3 text-text-secondary">
                  {c.assignee ? formatFullName(c.assignee.firstName, c.assignee.lastName) : '—'}
                </td>
                <td className="px-4 py-3 text-text-secondary">{formatDate(c.createdAt)}</td>
                <td className="relative px-4 py-3">
                  <button
                    onClick={() => setOpenMenu(o => o === c.id ? null : c.id)}
                    className="rounded p-1 text-text-muted hover:bg-surface-3"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {openMenu === c.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div className="absolute right-4 top-10 z-20 w-36 rounded-md border border-border bg-surface py-1 shadow-modal">
                        <button
                          onClick={() => { onDelete(c.id); setOpenMenu(null) }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
