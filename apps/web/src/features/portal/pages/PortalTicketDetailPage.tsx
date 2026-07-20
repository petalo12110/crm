import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { formatDateTime } from '@/lib/formatters'
import { portalTicketsApi } from '../api/portal.api'

export function PortalTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [replyBody, setReplyBody] = useState('')
  const qc = useQueryClient()

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['portal', 'tickets', id],
    queryFn:  () => portalTicketsApi.getById(id!),
    enabled:  !!id,
    refetchInterval: 20_000,
  })

  const replyMutation = useMutation({
    mutationFn: (body: string) => portalTicketsApi.reply(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'tickets', id] })
      setReplyBody('')
    },
  })

  if (isLoading) return <LoadingState />
  if (isError || !ticket) return <ErrorState message="Ticket not found" onRetry={() => refetch()} />

  const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

  return (
    <div className="mx-auto max-w-3xl p-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </button>

      <div className="mb-4 rounded-lg border border-border bg-surface p-5">
        <p className="font-mono text-xs text-text-muted">{ticket.ticketNumber}</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-text-primary">{ticket.title}</h1>
          <div className="flex shrink-0 gap-2">
            <Badge status={ticket.priority}>{ticket.priority}</Badge>
            <Badge status={ticket.status}>{ticket.status.replace('_', ' ')}</Badge>
          </div>
        </div>
        {ticket.description && <p className="mt-2 text-sm text-text-secondary">{ticket.description}</p>}
      </div>

      <div className="space-y-3">
        {ticket.replies?.length > 0 ? (
          ticket.replies.map((r: Record<string, unknown>) => {
            const fromAgent = !!r.userId
            const author = fromAgent
              ? `${(r.user as Record<string,string>)?.firstName ?? 'Support'} ${(r.user as Record<string,string>)?.lastName ?? ''}`.trim()
              : 'You'
            return (
              <div
                key={r.id as string}
                className={`max-w-[85%] rounded-lg border p-3 text-sm ${
                  fromAgent ? 'border-border bg-surface' : 'ml-auto border-primary/30 bg-primary/5'
                }`}
              >
                <p className="mb-1 text-xs font-medium text-text-muted">
                  {author} · {formatDateTime(r.createdAt as string)}
                </p>
                <p className="whitespace-pre-wrap text-text-primary">{r.body as string}</p>
              </div>
            )
          })
        ) : (
          <p className="py-6 text-center text-sm text-text-secondary">No replies yet — we'll respond here soon.</p>
        )}
      </div>

      {isClosed ? (
        <div className="mt-4 rounded-md bg-surface-3 px-3 py-2 text-center text-sm text-text-secondary">
          This ticket is {ticket.status.toLowerCase()}. Open a new ticket if you need further help.
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <textarea
            rows={2}
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder="Type a reply..."
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
          <Button
            onClick={() => replyBody.trim() && replyMutation.mutate(replyBody)}
            loading={replyMutation.isPending}
            disabled={!replyBody.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
