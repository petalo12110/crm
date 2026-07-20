import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/FormControls'
import { Modal, ConfirmDialog } from '@/components/ui/Overlay'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useDebounce } from '@/hooks/useDebounce'
import { CustomerTable } from '../components/CustomerTable'
import { CustomerForm, CustomerFormValues } from '../components/CustomerForm'
import { ImportCsvModal } from '../components/ImportCsvModal'
import { useCustomers, useCreateCustomer, useDeleteCustomer } from '../hooks/useCustomers'

export function CustomersPage() {
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteId, setDeleteId]     = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 350)
  const navigate = useNavigate()

  const filters = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(status && { status }),
  }

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useCustomers(filters)
  const createMutation = useCreateCustomer()
  const deleteMutation  = useDeleteCustomer()

  const customers = data?.pages.flatMap(p => p.data) ?? []
  const total     = data?.pages[0]?.meta.total ?? 0

  const handleCreate = (values: CustomerFormValues) => {
    createMutation.mutate(values, {
      onSuccess: (created) => {
        setCreateOpen(false)
        navigate(`/customers/${created.id}`)
      },
    })
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Customers"
        subtitle={`${total.toLocaleString()} total`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Customer
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-72"
        />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="PROSPECT">Prospect</option>
          <option value="BLOCKED">Blocked</option>
        </Select>
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isError && !isLoading && customers.length === 0 && (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to get started."
          action={<Button onClick={() => setCreateOpen(true)}>Add Customer</Button>}
        />
      )}

      {(isLoading || customers.length > 0) && (
        <CustomerTable customers={customers} isLoading={isLoading} onDelete={setDeleteId} />
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New customer">
        <CustomerForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          loading={createMutation.isPending}
        />
      </Modal>

      <ImportCsvModal open={importOpen} onClose={() => setImportOpen(false)} />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete customer?"
        description="This customer will be soft-deleted and can be restored later."
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
