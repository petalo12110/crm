import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, Building2, Edit2, Send } from 'lucide-react'
import { Avatar, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Overlay'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { formatFullName, formatDate } from '@/lib/formatters'
import { useCustomer, useUpdateCustomer } from '../hooks/useCustomers'
import { CustomerForm, CustomerFormValues } from '../components/CustomerForm'
import { CustomerTimeline } from '../components/CustomerTimeline'
import { SendEmailModal } from '../components/SendEmailModal'

type Tab = 'overview' | 'timeline' | 'leads' | 'tickets'

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const { data: customer, isLoading, isError } = useCustomer(id)
  const updateMutation = useUpdateCustomer(id ?? '')

  if (isLoading) return <LoadingState />
  if (isError || !customer) return <ErrorState message="Customer not found" />

  const handleUpdate = (values: CustomerFormValues) => {
    updateMutation.mutate(values, { onSuccess: () => setEditOpen(false) })
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/customers')}
        className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-start justify-between rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <Avatar firstName={customer.firstName} lastName={customer.lastName} size="lg" />
              <div>
                <h1 className="text-xl font-semibold text-text-primary">
                  {formatFullName(customer.firstName, customer.lastName)}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <Badge status={customer.status}>{customer.status}</Badge>
                  {customer.companyName && (
                    <span className="text-sm text-text-secondary">{customer.companyName}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {customer.email && (
                <Button variant="secondary" size="sm" onClick={() => setEmailOpen(true)}>
                  <Send className="h-3.5 w-3.5" /> Email
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border">
            <nav className="flex gap-1">
              {(['overview', 'timeline', 'leads', 'tickets'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium capitalize
                    ${tab === t ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            {tab === 'overview' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Email"   value={customer.email} icon={Mail} />
                <Field label="Phone"   value={customer.phone} icon={Phone} />
                <Field label="Industry"value={customer.industry} icon={Building2} />
                <Field label="Type"    value={customer.customerType} />
                <Field label="Created" value={formatDate(customer.createdAt)} />
                <Field label="Updated" value={formatDate(customer.updatedAt)} />
                {customer.notes && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium uppercase text-text-muted">Notes</p>
                    <p className="mt-1 text-text-primary">{customer.notes}</p>
                  </div>
                )}
              </div>
            )}
            {tab === 'timeline' && <CustomerTimeline customerId={id!} />}
            {tab === 'leads'   && <p className="text-sm text-text-secondary">{customer._count?.leads ?? 0} linked leads</p>}
            {tab === 'tickets' && <p className="text-sm text-text-secondary">{customer._count?.tickets ?? 0} linked tickets</p>}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Details</h3>
            <div className="space-y-2 text-sm">
              <SidebarRow label="Owner"    value={customer.owner ? formatFullName(customer.owner.firstName, customer.owner.lastName) : '—'} />
              <SidebarRow label="Assigned" value={customer.assignee ? formatFullName(customer.assignee.firstName, customer.assignee.lastName) : '—'} />
            </div>
            {customer.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {customer.tags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit customer">
        <CustomerForm
          defaultValues={customer}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          loading={updateMutation.isPending}
        />
      </Modal>

      {customer.email && (
        <SendEmailModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          customerId={customer.id}
          customerEmail={customer.email}
          customerName={formatFullName(customer.firstName, customer.lastName)}
        />
      )}
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
