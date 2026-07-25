import { useState } from 'react'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Overlay'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { LeadKanban } from '../components/LeadKanban'
import { LeadForm, LeadFormValues } from '../components/LeadForm'
import { useLeads, useCreateLead } from '../hooks/useLeads'

export function LeadsPage() {
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useLeads()
  const createMutation = useCreateLead()

  const leads = data?.data ?? []

  const handleCreate = (values: LeadFormValues) => {
    createMutation.mutate({ ...values }, { onSuccess: () => setCreateOpen(false) })
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} active`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border-strong p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={`rounded p-1.5 ${view === 'kanban' ? 'bg-primary/10 text-primary' : 'text-text-muted'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('table')}
                className={`rounded p-1.5 ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-text-muted'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Lead
            </Button>
          </div>
        }
      />

      {isError && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <LoadingState />}
      {!isLoading && !isError && leads.length === 0 && (
        <EmptyState title="No leads yet" description="Create your first lead to start the pipeline." />
      )}

      {!isLoading && leads.length > 0 && view === 'kanban' && <LeadKanban leads={leads} />}
      {!isLoading && leads.length > 0 && view === 'table' && <LeadTableView leads={leads} />}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New lead">
        <LeadForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} loading={createMutation.isPending} />
      </Modal>
    </div>
  )
}

function LeadTableView({ leads }: { leads: Record<string, unknown>[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Probability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {leads.map(l => (
            <tr key={l.id as string} className="hover:bg-surface-2">
              <td className="px-4 py-3 font-medium text-text-primary">{l.title as string}</td>
              <td className="px-4 py-3 text-text-secondary">{l.stage as string}</td>
              <td className="px-4 py-3 text-text-secondary">{String(l.value ?? '—')}</td>
              <td className="px-4 py-3 text-text-secondary">{String(l.probability ?? '—')}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
