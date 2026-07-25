import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/FormControls'
import { Modal } from '@/components/ui/Overlay'
import { Badge } from '@/components/ui/Badge'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { formatDate } from '@/lib/formatters'
import { portalTicketsApi } from '../api/portal.api'

interface NewTicketForm {
  title: string
  description?: string
  priority?: string
}

export function PortalTicketsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['portal', 'tickets'],
    queryFn:  portalTicketsApi.list,
    refetchInterval: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (values: NewTicketForm) => portalTicketsApi.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'tickets'] })
      setCreateOpen(false)
    },
  })

  const tickets = data ?? []

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">My Support Tickets</h1>
          <p className="text-sm text-text-secondary">Track and reply to your support requests.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New ticket
        </Button>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && tickets.length === 0 && (
        <EmptyState
          title="No tickets yet"
          description="Need help with something? Open a new ticket and we'll get back to you."
          action={<Button size="sm" onClick={() => setCreateOpen(true)}>New ticket</Button>}
        />
      )}

      {!isLoading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((t: Record<string, unknown>) => (
            <Link
              key={t.id as string}
              to={`${t.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 hover:border-primary"
            >
              <div>
                <p className="font-mono text-xs text-text-muted">{t.ticketNumber as string}</p>
                <p className="font-medium text-text-primary">{t.title as string}</p>
                <p className="text-xs text-text-muted">Opened {formatDate(t.createdAt as string)}</p>
              </div>
              <div className="flex gap-2">
                <Badge status={t.priority as string}>{t.priority as string}</Badge>
                <Badge status={t.status as string}>{(t.status as string).replace('_', ' ')}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New support ticket">
        <NewTicketForm
          loading={createMutation.isPending}
          error={createMutation.isError ? "Couldn't create the ticket — please try again." : undefined}
          onSubmit={values => createMutation.mutate(values)}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  )
}

function NewTicketForm({ onSubmit, onCancel, loading, error }: {
  onSubmit: (values: NewTicketForm) => void
  onCancel: () => void
  loading?: boolean
  error?:   string
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<NewTicketForm>({
    defaultValues: { priority: 'MEDIUM' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Input label="Subject" {...register('title', { required: 'Please describe your issue briefly' })} error={errors.title?.message} />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text-primary">Details</label>
        <textarea
          rows={4}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          placeholder="Tell us more about what's going on..."
          {...register('description')}
        />
      </div>
      <Select label="Priority" {...register('priority')}>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical — I'm blocked</option>
      </Select>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Submit ticket</Button>
      </div>
    </form>
  )
}
