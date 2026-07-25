import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency, formatFullName } from '@/lib/formatters'
import { Avatar } from '@/components/ui/Badge'
import { useTransitionStage } from '../hooks/useLeads'

type LeadStage =
  | 'NEW' | 'CONTACTED' | 'QUALIFIED'
  | 'PROPOSAL_SENT' | 'NEGOTIATION'
  | 'WON' | 'LOST' | 'ARCHIVED'

// Valid transitions per stage
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

const STAGES: { key: LeadStage; label: string; color: string; dot: string }[] = [
  { key: 'NEW',           label: 'New',           color: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500' },
  { key: 'CONTACTED',     label: 'Contacted',     color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  { key: 'QUALIFIED',     label: 'Qualified',     color: 'bg-violet-50 border-violet-200',dot: 'bg-violet-500' },
  { key: 'PROPOSAL_SENT', label: 'Proposal Sent', color: 'bg-orange-50 border-orange-200',dot: 'bg-orange-500' },
  { key: 'NEGOTIATION',   label: 'Negotiation',   color: 'bg-pink-50 border-pink-200',   dot: 'bg-pink-500' },
  { key: 'WON',           label: 'Won',           color: 'bg-green-50 border-green-200', dot: 'bg-green-600' },
  { key: 'LOST',          label: 'Lost',          color: 'bg-red-50 border-red-200',     dot: 'bg-red-500' },
]

interface Lead {
  id:          string
  title:       string
  stage:       LeadStage
  value:       string | number | null
  probability: string | number | null
  customer:    { firstName: string; lastName: string } | null
  assignee:    { firstName: string; lastName: string } | null
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      to={`/leads/${lead.id}`}
      className="block rounded-md border border-border bg-surface p-3 shadow-raised
        hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
    >
      <p className="text-sm font-medium text-text-primary line-clamp-2 leading-snug">
        {lead.title}
      </p>
      {lead.customer && (
        <p className="mt-1 text-xs text-text-secondary">
          {formatFullName(lead.customer.firstName, lead.customer.lastName)}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          {formatCurrency(lead.value)}
        </span>
        {lead.assignee && (
          <Avatar firstName={lead.assignee.firstName} lastName={lead.assignee.lastName} size="sm" />
        )}
      </div>
      {lead.probability != null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${lead.probability}%` }} />
        </div>
      )}
    </Link>
  )
}

export function LeadKanban({ leads }: { leads: Lead[] }) {
  const transition = useTransitionStage()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const grouped = STAGES.map(s => ({
    ...s,
    leads: leads.filter(l => l.stage === s.key),
  }))

  const handleDrop = (targetStage: LeadStage) => {
    if (!dragId) return
    const lead = leads.find(l => l.id === dragId)
    if (!lead || lead.stage === targetStage) { setDragId(null); setDragOver(null); return }

    const allowed = TRANSITIONS[lead.stage] ?? []
    if (!allowed.includes(targetStage)) {
      alert(`Cannot move from ${lead.stage} to ${targetStage}.\nValid next stages: ${allowed.join(', ') || 'none'}`)
      setDragId(null); setDragOver(null)
      return
    }
    transition.mutate({ id: dragId, stage: targetStage })
    setDragId(null); setDragOver(null)
  }

  return (
    /* Horizontal scroll container — works on mobile too */
    <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
        {grouped.map(col => {
          const totalValue = col.leads.reduce((s, l) => s + Number(l.value ?? 0), 0)
          const isTarget   = dragOver === col.key

          return (
            <div
              key={col.key}
              className="w-64 shrink-0"
              onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column header */}
              <div className="mb-2 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-text-primary">{col.label}</span>
                  <span className="text-xs text-text-muted">({col.leads.length})</span>
                </div>
                {col.leads.length > 0 && (
                  <span className="text-xs font-medium text-text-secondary">
                    {formatCurrency(totalValue)}
                  </span>
                )}
              </div>

              {/* Drop zone */}
              <div className={`min-h-[160px] rounded-lg border-2 p-2 space-y-2 transition-colors
                ${isTarget
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-dashed border-border bg-surface-2'}`}
              >
                {col.leads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null) }}
                    className={`transition-opacity ${dragId === lead.id ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <LeadCard lead={lead} />
                  </div>
                ))}

                {col.leads.length === 0 && !isTarget && (
                  <div className="flex h-24 items-center justify-center">
                    <p className="text-xs text-text-muted">Drop here</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
