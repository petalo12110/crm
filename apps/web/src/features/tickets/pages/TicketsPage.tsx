import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/FormControls'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Overlay'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useDebounce } from '@/hooks/useDebounce'
import { TicketTable } from '../components/TicketTable'
import { useTickets, useCreateTicket } from '../hooks/useTickets'
import { useForm } from 'react-hook-form'
import { Select as FormSelect } from '@/components/ui/FormControls'
import { Textarea } from '@/components/ui/FormControls'

function TicketForm({ onSubmit, onCancel, loading }: {
  onSubmit: (v: Record<string, unknown>) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm()
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Title" error={errors.title?.message as string}
        {...register('title', { required: 'Title is required' })} />
      <Textarea label="Description" rows={3} {...register('description')} />
      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Priority" {...register('priority')}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </FormSelect>
        <Input label="Category" {...register('category')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Create ticket</Button>
      </div>
    </form>
  )
}

export function TicketsPage() {
  const [status, setStatus]     = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch]     = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const debouncedSearch = useDebounce(search, 350)

  const filters = {
    ...(status   && { status }),
    ...(priority && { priority }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }

  const { data, isLoading, isError, refetch } = useTickets(filters)
  const createMutation = useCreateTicket()

  const allTickets = data?.data ?? []
  const total       = data?.meta?.total ?? allTickets.length

  // Same convention as Tasks: active tickets (not Resolved/Closed) show by
  // default, history is one click away rather than piling up forever. An
  // explicit status filter always wins over the toggle.
  const explicitClosedFilter = status === 'RESOLVED' || status === 'CLOSED'
  const closedCount = allTickets.filter((t: Record<string, unknown>) =>
    t.status === 'RESOLVED' || t.status === 'CLOSED').length
  const tickets = (showClosed || explicitClosedFilter)
    ? allTickets
    : allTickets.filter((t: Record<string, unknown>) => t.status !== 'RESOLVED' && t.status !== 'CLOSED')

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Support Tickets"
        subtitle={`${total} total`}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search tickets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Select value={priority} onChange={e => setPriority(e.target.value)} className="w-36">
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </Select>
        {!explicitClosedFilter && closedCount > 0 && (
          <button
            onClick={() => setShowClosed(s => !s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
              ${showClosed
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border-strong text-text-secondary hover:border-primary hover:text-primary'}`}
          >
            {showClosed ? 'Hide' : 'Show'} resolved &amp; closed ({closedCount})
          </button>
        )}
      </div>

      {isError   && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <LoadingState />}
      {!isLoading && !isError && allTickets.length === 0 && (
        <EmptyState title="No tickets" description="All clear — no support tickets right now." />
      )}
      {!isLoading && !isError && allTickets.length > 0 && tickets.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm font-medium text-text-primary">All caught up</p>
          <p className="mt-1 text-sm text-text-secondary">
            {closedCount} resolved or closed ticket{closedCount === 1 ? '' : 's'} — hidden by default.{' '}
            <button onClick={() => setShowClosed(true)} className="text-primary hover:underline">Show them</button>
          </p>
        </div>
      )}
      {(isLoading || tickets.length > 0) && (
        <TicketTable tickets={tickets} isLoading={isLoading} />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New ticket">
        <TicketForm
          onSubmit={v => createMutation.mutate(v, { onSuccess: () => setCreateOpen(false) })}
          onCancel={() => setCreateOpen(false)}
          loading={createMutation.isPending}
        />
      </Modal>
    </div>
  )
}
