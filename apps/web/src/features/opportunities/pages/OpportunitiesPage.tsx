import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Plus, TrendingUp, ChevronDown } from 'lucide-react'
import { PageHeader }   from '@/components/layout/Breadcrumb'
import { Button }       from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Overlay'
import { Input }        from '@/components/ui/Input'
import { Select, Textarea } from '@/components/ui/FormControls'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { formatCurrency, formatDate, formatFullName } from '@/lib/formatters'
import { useForm }      from 'react-hook-form'
import { usePermission } from '@/hooks/usePermission'

// ── Stage definitions ─────────────────────────────────────────

const STAGES = [
  { key: 'PROSPECTING',       label: 'Prospecting',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'QUALIFICATION',     label: 'Qualification',     color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'NEEDS_ANALYSIS',    label: 'Needs Analysis',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'VALUE_PROPOSITION', label: 'Value Proposition', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'DECISION_MAKERS',   label: 'Decision Makers',   color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { key: 'PROPOSAL',          label: 'Proposal',          color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { key: 'NEGOTIATION',       label: 'Negotiation',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'CLOSED_WON',        label: 'Closed Won',        color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'CLOSED_LOST',       label: 'Closed Lost',       color: 'bg-red-100 text-red-700 border-red-200' },
]

const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]))

function StageBadge({ stage }: { stage: string }) {
  const s = stageMap[stage]
  if (!s) return <span className="text-xs text-text-muted">{stage}</span>
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

// ── Stage picker dropdown ──────────────────────────────────────

function StagePicker({ oppId, current, canEdit }: { oppId: string; current: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (stage: string) => api.patch(`/opportunities/${oppId}`, { stage }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['opportunities'] }); setOpen(false) },
  })

  if (!canEdit) return <StageBadge stage={current} />

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1"
      >
        <StageBadge stage={current} />
        <ChevronDown className="h-3 w-3 text-text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border border-border
            bg-surface shadow-modal py-1 max-h-64 overflow-y-auto">
            {STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => mutation.mutate(s.key)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                  hover:bg-surface-2 ${s.key === current ? 'bg-primary/5 font-medium' : ''}`}
              >
                <span className={`h-2 w-2 rounded-full border ${s.color}`} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── API ───────────────────────────────────────────────────────

const KEY = 'opportunities'

function useOpportunities(stage: string) {
  return useQuery({
    queryKey: [KEY, 'list', stage],
    queryFn:  () => api.get('/opportunities', { params: { ...(stage ? { stage } : {}), limit: 100 } }).then(r => r.data),
  })
}

function useCreateOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/opportunities', body).then(r => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

function useUpdateOpportunity(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/opportunities/${id}`, body).then(r => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

function useDeleteOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/opportunities/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ── Form ──────────────────────────────────────────────────────

interface OppForm {
  title:           string
  stage:           string
  expectedRevenue?: number
  probability?:     number
  expectedClose?:   string
  quotedValue?:     number
  notes?:           string
}

function OppFormUI({ defaultValues, onSubmit, onCancel, loading }: {
  defaultValues?: Partial<OppForm>
  onSubmit: (v: OppForm) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<OppForm>({
    defaultValues: { stage: 'PROSPECTING', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Title" error={errors.title?.message}
        {...register('title', { required: 'Title is required' })} />

      <Select label="Stage" {...register('stage')}>
        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Expected Revenue" type="number" min={0}
          {...register('expectedRevenue', { valueAsNumber: true })} />
        <Input label="Probability (%)" type="number" min={0} max={100}
          {...register('probability', { valueAsNumber: true })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Quoted Value" type="number" min={0}
          {...register('quotedValue', { valueAsNumber: true })} />
        <Input label="Expected Close" type="date" {...register('expectedClose')} />
      </div>

      <Textarea label="Notes" rows={3} {...register('notes')} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Save</Button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function OpportunitiesPage() {
  const [stageFilter, setStageFilter] = useState('')
  const [createOpen, setCreate]       = useState(false)
  const [editOpp, setEditOpp]         = useState<Record<string, unknown> | null>(null)
  const [deleteId, setDeleteId]       = useState<string | null>(null)

  const canEdit = usePermission('SALES')

  const { data, isLoading, isError, refetch } = useOpportunities(stageFilter)
  const createMutation = useCreateOpportunity()
  const updateMutation = useUpdateOpportunity((editOpp?.id as string) ?? '')
  const deleteMutation = useDeleteOpportunity()

  const opps  = data?.data ?? []
  const total = data?.meta?.total ?? opps.length

  // Summary metrics
  const activeOpps  = opps.filter((o: Record<string,unknown>) => !['CLOSED_WON','CLOSED_LOST'].includes(o.stage as string))
  const wonOpps     = opps.filter((o: Record<string,unknown>) => o.stage === 'CLOSED_WON')
  const pipelineVal = activeOpps.reduce((s: number, o: Record<string,unknown>) => s + Number(o.expectedRevenue ?? 0), 0)
  const wonVal      = wonOpps.reduce((s: number, o: Record<string,unknown>) => s + Number(o.expectedRevenue ?? 0), 0)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Opportunities"
        subtitle={`${total} total`}
        action={canEdit ? (
          <Button onClick={() => setCreate(true)} size="sm">
            <Plus className="h-4 w-4" /> New
          </Button>
        ) : undefined}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3 md:p-4">
          <p className="text-xs font-medium uppercase text-text-muted">Pipeline</p>
          <p className="mt-1 text-lg font-bold text-text-primary md:text-xl">{formatCurrency(pipelineVal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 md:p-4">
          <p className="text-xs font-medium uppercase text-text-muted">Won</p>
          <p className="mt-1 text-lg font-bold text-success md:text-xl">{formatCurrency(wonVal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 md:p-4">
          <p className="text-xs font-medium uppercase text-text-muted">Active</p>
          <p className="mt-1 text-lg font-bold text-text-primary md:text-xl">{activeOpps.length}</p>
        </div>
      </div>

      {/* Stage filter */}
      <Select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="w-full max-w-xs">
        <option value="">All stages</option>
        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </Select>

      {isError   && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <LoadingState />}

      {!isLoading && !isError && opps.length === 0 && (
        <EmptyState
          title="No opportunities yet"
          description="Track deals, forecast revenue, and close more business."
          action={canEdit ? <Button onClick={() => setCreate(true)}>New Opportunity</Button> : undefined}
          icon={<TrendingUp className="h-10 w-10" />}
        />
      )}

      {opps.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {opps.map((o: Record<string, unknown>) => {
              const assignee = o.assignee as { firstName: string; lastName: string } | null
              return (
                <div key={o.id as string}
                  className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-text-primary flex-1 min-w-0 truncate">
                      {o.title as string}
                    </p>
                    <StagePicker oppId={o.id as string} current={o.stage as string} canEdit={canEdit} />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-bold text-text-primary">
                      {formatCurrency(o.expectedRevenue as number)}
                    </span>
                    {o.probability != null && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full bg-primary rounded-full"
                            style={{ width: `${o.probability}%` }} />
                        </div>
                        {String(o.probability)}%
                      </div>
                    )}
                  </div>

                  {(!!(o.expectedClose as string) || !!assignee) && (
                    <div className="mt-1.5 flex items-center justify-between text-xs text-text-secondary">
                      <span>{assignee ? formatFullName(assignee.firstName, assignee.lastName) : '—'}</span>
                      {!!(o.expectedClose as string) && <span>Closes {formatDate(o.expectedClose as string)}</span>}
                    </div>
                  )}

                  {canEdit && (
                    <div className="mt-2 flex gap-2 border-t border-border pt-2">
                      <button onClick={() => setEditOpp(o)}
                        className="flex-1 rounded border border-border py-1.5 text-xs font-medium
                          text-text-secondary hover:bg-surface-3">
                        Edit
                      </button>
                      <button onClick={() => setDeleteId(o.id as string)}
                        className="flex-1 rounded border border-danger/30 py-1.5 text-xs font-medium
                          text-danger hover:bg-danger/5">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Probability</th>
                  <th className="px-4 py-3">Close Date</th>
                  <th className="px-4 py-3">Assigned</th>
                  {canEdit && <th className="px-4 py-3 w-28">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {opps.map((o: Record<string, unknown>) => {
                  const assignee = o.assignee as { firstName: string; lastName: string } | null
                  return (
                    <tr key={o.id as string} className="hover:bg-surface-2">
                      <td className="px-4 py-3 font-medium text-text-primary max-w-[200px] truncate">
                        {o.title as string}
                      </td>
                      <td className="px-4 py-3">
                        <StagePicker oppId={o.id as string} current={o.stage as string} canEdit={canEdit} />
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {formatCurrency(o.expectedRevenue as number)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                            <div className="h-full rounded-full bg-primary"
                              style={{ width: `${o.probability ?? 0}%` }} />
                          </div>
                          <span className="text-xs text-text-secondary">{String(o.probability ?? 0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDate(o.expectedClose as string)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {assignee ? formatFullName(assignee.firstName, assignee.lastName) : '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditOpp(o)}
                              className="text-xs font-medium text-primary hover:underline">Edit</button>
                            <button onClick={() => setDeleteId(o.id as string)}
                              className="text-xs font-medium text-danger hover:underline">Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Opportunity">
        <OppFormUI
          onSubmit={v => createMutation.mutate(v as unknown as Record<string, unknown>, {
            onSuccess: () => setCreate(false),
          })}
          onCancel={() => setCreate(false)}
          loading={createMutation.isPending}
        />
        {createMutation.isError && (
          <p className="mt-2 text-sm text-danger">Failed to create. Please try again.</p>
        )}
      </Modal>

      {/* Edit */}
      <Modal open={!!editOpp} onClose={() => setEditOpp(null)} title="Edit Opportunity">
        {editOpp && (
          <OppFormUI
            defaultValues={{
              title:           editOpp.title as string,
              stage:           editOpp.stage as string,
              expectedRevenue: editOpp.expectedRevenue as number,
              probability:     editOpp.probability as number,
              expectedClose:   editOpp.expectedClose ? (editOpp.expectedClose as string).slice(0, 10) : undefined,
              quotedValue:     editOpp.quotedValue as number,
              notes:           editOpp.notes as string,
            }}
            onSubmit={v => updateMutation.mutate(v as unknown as Record<string, unknown>, {
              onSuccess: () => setEditOpp(null),
            })}
            onCancel={() => setEditOpp(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete opportunity?"
        description="This will permanently remove the opportunity."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
