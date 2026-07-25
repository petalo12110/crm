import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, DollarSign, Percent, Calendar, Tag as TagIcon } from 'lucide-react'
import { Badge, Avatar } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Overlay'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { formatFullName, formatCurrency, formatDate, formatDateTime } from '@/lib/formatters'
import { useLead, useUpdateLead, useDeleteLead, useTransitionStage } from '../hooks/useLeads'
import { LeadForm, LeadFormValues } from '../components/LeadForm'

type LeadStage =
  | 'NEW' | 'CONTACTED' | 'QUALIFIED'
  | 'PROPOSAL_SENT' | 'NEGOTIATION'
  | 'WON' | 'LOST' | 'ARCHIVED'

// Kept in sync with LeadKanban.tsx — same valid-transition rules apply here
// since both surfaces call the same PATCH /leads/:id/stage endpoint.
const TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW:           ['CONTACTED', 'QUALIFIED', 'LOST', 'ARCHIVED'],
  CONTACTED:     ['QUALIFIED', 'LOST', 'ARCHIVED'],
  QUALIFIED:     ['PROPOSAL_SENT', 'LOST', 'ARCHIVED'],
  PROPOSAL_SENT: ['NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'],
  NEGOTIATION:   ['WON', 'LOST', 'ARCHIVED'],
  WON:           ['ARCHIVED'],
  LOST:          ['CONTACTED', 'ARCHIVED'],
  ARCHIVED:      [],
}

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  PROPOSAL_SENT: 'Proposal Sent', NEGOTIATION: 'Negotiation',
  WON: 'Won', LOST: 'Lost', ARCHIVED: 'Archived',
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: lead, isLoading, isError } = useLead(id)
  const updateMutation     = useUpdateLead(id ?? '')
  const deleteMutation     = useDeleteLead()
  const transitionMutation = useTransitionStage()

  if (isLoading) return <LoadingState />
  if (isError || !lead) return <ErrorState message="Lead not found" />

  const handleUpdate = (values: LeadFormValues) => {
    updateMutation.mutate({ ...values }, { onSuccess: () => setEditOpen(false) })
  }

  const handleDelete = () => {
    deleteMutation.mutate(lead.id, { onSuccess: () => navigate('/leads') })
  }

  const handleTransition = (stage: LeadStage) => {
    transitionMutation.mutate({ id: lead.id, stage })
  }

  const nextStages = TRANSITIONS[lead.stage as LeadStage] ?? []

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/leads')}
        className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-start justify-between rounded-lg border border-border bg-surface p-5">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">{lead.title}</h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge status={lead.stage}>{STAGE_LABELS[lead.stage as LeadStage] ?? lead.stage}</Badge>
                {lead.customer && (
                  <span className="text-sm text-text-secondary">
                    {formatFullName(lead.customer.firstName, lead.customer.lastName)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Stage transitions */}
          {nextStages.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-medium uppercase text-text-muted">Move to</p>
              <div className="flex flex-wrap gap-2">
                {nextStages.map(stage => (
                  <Button
                    key={stage}
                    variant="secondary"
                    size="sm"
                    loading={transitionMutation.isPending}
                    onClick={() => handleTransition(stage)}
                  >
                    {STAGE_LABELS[stage]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Overview */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Value"          value={formatCurrency(lead.value)}       icon={DollarSign} />
              <Field label="Probability"    value={lead.probability != null ? `${Math.round(Number(lead.probability))}%` : '—'} icon={Percent} />
              <Field label="Source"         value={lead.source} />
              <Field label="Campaign"       value={lead.campaign} />
              <Field label="Expected close" value={formatDate(lead.expectedClose)}    icon={Calendar} />
              <Field label="Created"        value={formatDate(lead.createdAt)} />
              {lead.notes && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase text-text-muted">Notes</p>
                  <p className="mt-1 text-text-primary">{lead.notes}</p>
                </div>
              )}
              {lead.tags?.length > 0 && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <TagIcon className="h-3.5 w-3.5 text-text-muted" />
                  {lead.tags.map((tag: string) => (
                    <span key={tag} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stage history */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Stage history</h3>
            {lead.stageHistory?.length > 0 ? (
              <ol className="space-y-3">
                {lead.stageHistory.map((h: {
                  id: string; toStage: string; note?: string | null
                  createdAt: string; user?: { firstName: string; lastName: string } | null
                }) => (
                  <li key={h.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-text-primary">
                        Moved to <span className="font-medium">{STAGE_LABELS[h.toStage as LeadStage] ?? h.toStage}</span>
                        {h.user && <> by {formatFullName(h.user.firstName, h.user.lastName)}</>}
                      </p>
                      {h.note && <p className="mt-0.5 text-text-secondary">{h.note}</p>}
                      <p className="mt-0.5 text-xs text-text-muted">{formatDateTime(h.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-text-secondary">No stage changes yet.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Details</h3>
            <div className="space-y-2 text-sm">
              <SidebarRow label="Owner"    value={lead.owner ? formatFullName(lead.owner.firstName, lead.owner.lastName) : '—'} />
              <SidebarRow label="Assigned" value={lead.assignee ? formatFullName(lead.assignee.firstName, lead.assignee.lastName) : '—'} />
            </div>
            {lead.assignee && (
              <div className="mt-3 flex items-center gap-2">
                <Avatar firstName={lead.assignee.firstName} lastName={lead.assignee.lastName} size="sm" />
                <span className="text-sm text-text-primary">
                  {formatFullName(lead.assignee.firstName, lead.assignee.lastName)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit lead">
        <LeadForm
          defaultValues={lead}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          loading={updateMutation.isPending}
        />
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete lead" size="sm">
        <p className="text-sm text-text-secondary">
          Are you sure you want to delete <span className="font-medium text-text-primary">{lead.title}</span>?
          This can't be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium uppercase text-text-muted">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      <p className="mt-0.5 text-text-primary">{value || '—'}</p>
    </div>
  )
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  )
}
