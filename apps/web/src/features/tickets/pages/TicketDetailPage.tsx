import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/FormControls'
import { Badge, Avatar } from '@/components/ui/Badge'
import { Select } from '@/components/ui/FormControls'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { formatRelativeTime, formatFullName } from '@/lib/formatters'
import { useTicket, useUpdateTicketStatus, useReplyToTicket } from '../hooks/useTickets'
import { usePermission } from '@/hooks/usePermission'

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [replyBody, setReplyBody]       = useState('')
  const [isInternal, setIsInternal]     = useState(false)
  const canManage = usePermission('SUPPORT')

  const { data: ticket, isLoading, isError } = useTicket(id)
  const statusMutation = useUpdateTicketStatus()
  const replyMutation  = useReplyToTicket(id ?? '')

  if (isLoading) return <LoadingState />
  if (isError || !ticket) return <ErrorState message="Ticket not found" />

  const handleReply = () => {
    if (!replyBody.trim()) return
    replyMutation.mutate({ body: replyBody, isInternal }, {
      onSuccess: () => setReplyBody(''),
    })
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <button
        onClick={() => navigate('/tickets')}
        className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </button>

      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-muted">{ticket.ticketNumber}</span>
                <Badge status={ticket.priority}>{ticket.priority}</Badge>
                <Badge status={ticket.status}>{ticket.status}</Badge>
                {ticket.slaBreached && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                    SLA Breached
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-xl font-semibold text-text-primary">{ticket.title}</h1>
              {ticket.description && (
                <p className="mt-2 text-sm text-text-secondary">{ticket.description}</p>
              )}
            </div>
            {canManage && (
              <Select
                value={ticket.status}
                onChange={e => statusMutation.mutate({ id: ticket.id, status: e.target.value })}
                className="w-40"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </Select>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary">
            {ticket.customer && (
              <span>Customer: {formatFullName(ticket.customer.firstName, ticket.customer.lastName)}</span>
            )}
            {ticket.assignee && (
              <span>Assigned: {formatFullName(ticket.assignee.firstName, ticket.assignee.lastName)}</span>
            )}
            <span>Created: {formatRelativeTime(ticket.createdAt)}</span>
            {ticket.slaDeadline && !ticket.slaBreached && (
              <span>SLA: {formatRelativeTime(ticket.slaDeadline)}</span>
            )}
          </div>
        </div>

        {/* Reply thread */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium text-text-primary">
              Conversation ({ticket.replies?.length ?? 0} replies)
            </h2>
          </div>

          <div className="divide-y divide-border">
            {ticket.replies?.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                <MessageSquare className="h-4 w-4" />
                No replies yet
              </div>
            )}

            {ticket.replies?.map((reply: Record<string, unknown>) => {
              const user = reply.user as { firstName: string; lastName: string } | null
              const internal = reply.isInternal as boolean
              return (
                <div
                  key={reply.id as string}
                  className={`flex gap-3 p-5 ${internal ? 'bg-warning/5' : ''}`}
                >
                  <Avatar firstName={user?.firstName} lastName={user?.lastName} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {user ? formatFullName(user.firstName, user.lastName) : 'Unknown'}
                      </span>
                      {internal && (
                        <span className="flex items-center gap-0.5 rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
                          <Lock className="h-3 w-3" /> Internal note
                        </span>
                      )}
                      <span className="text-xs text-text-muted ml-auto">
                        {formatRelativeTime(reply.createdAt as string)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{reply.body as string}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {canManage && (
            <div className="border-t border-border p-5 space-y-3">
              <Textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                rows={4}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong text-primary"
                  />
                  <Lock className="h-3.5 w-3.5" />
                  Internal note (hidden from customer)
                </label>
                <Button
                  onClick={handleReply}
                  loading={replyMutation.isPending}
                  disabled={!replyBody.trim()}
                >
                  {isInternal ? 'Add note' : 'Send reply'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
