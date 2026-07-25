import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Plus, Shield, UserX, ChevronDown } from 'lucide-react'
import { PageHeader }   from '@/components/layout/Breadcrumb'
import { Button }       from '@/components/ui/Button'
import { Input }        from '@/components/ui/Input'
import { Select }       from '@/components/ui/FormControls'
import { Modal, ConfirmDialog } from '@/components/ui/Overlay'
import { Avatar }       from '@/components/ui/Badge'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { formatFullName, formatRelativeTime } from '@/lib/formatters'
import { useDebounce }  from '@/hooks/useDebounce'
import { usePermission } from '@/hooks/usePermission'
import { useAuth }      from '@/context/AuthContext'
import { useForm }      from 'react-hook-form'

// ── Hooks ─────────────────────────────────────────────────────

function useEmployees(search: string) {
  return useQuery({
    queryKey: ['employees', 'list', search],
    queryFn:  () => api.get('/employees', { params: search ? { search } : {} }).then(r => r.data),
  })
}

function usePerformance() {
  return useQuery({
    queryKey: ['employees', 'performance'],
    queryFn:  () => api.get('/employees/performance').then(r => r.data.data),
    staleTime: 300_000,
  })
}

function useInviteEmployee(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/companies/${companyId}/members`, body).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

function useUpdateRole(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role, department, jobTitle }: { memberId: string; role: string; department?: string; jobTitle?: string }) =>
      api.patch(`/companies/${companyId}/members/${memberId}`, { role, department, jobTitle }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

function useDeactivateEmployee(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/companies/${companyId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

// ── Role info ─────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  COMPANY_OWNER: { label: 'Owner',    color: 'bg-violet-100 text-violet-700', description: 'Full company access' },
  MANAGER:       { label: 'Manager',  color: 'bg-blue-100 text-blue-700',     description: 'Manage customers, leads, team' },
  SALES_REP:     { label: 'Sales Rep',color: 'bg-green-100 text-green-700',   description: 'Manage own leads & customers' },
  SUPPORT:       { label: 'Support',  color: 'bg-amber-100 text-amber-700',   description: 'Handle support tickets' },
  EMPLOYEE:      { label: 'Employee', color: 'bg-surface-3 text-text-secondary', description: 'View assigned records' },
}

// ── Invite form ───────────────────────────────────────────────

interface InviteForm {
  email:      string
  firstName:  string
  lastName:   string
  role:       string
  department: string
  jobTitle:   string
}

function InviteEmployeeForm({ onSubmit, onCancel, loading }: {
  onSubmit: (v: InviteForm) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<InviteForm>({
    defaultValues: { role: 'EMPLOYEE' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-primary">
        The new employee will receive an email with a link to set their own password. The link expires in 7 days.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" error={errors.firstName?.message}
          {...register('firstName', { required: 'Required' })} />
        <Input label="Last name" error={errors.lastName?.message}
          {...register('lastName', { required: 'Required' })} />
      </div>

      <Input label="Email address" type="email" error={errors.email?.message}
        {...register('email', { required: 'Required' })} />

      <Select label="Role" {...register('role')}>
        <option value="MANAGER">Manager — manage customers, leads, tasks, reports</option>
        <option value="SALES_REP">Sales Rep — own leads and assigned customers</option>
        <option value="SUPPORT">Support — handle support tickets</option>
        <option value="EMPLOYEE">Employee — limited view access</option>
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Department (optional)" {...register('department')} />
        <Input label="Job title (optional)"  {...register('jobTitle')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Invite employee</Button>
      </div>
    </form>
  )
}

// ── Role change dropdown ──────────────────────────────────────

function RoleChanger({ member, companyId, canManage }: {
  member: Record<string, unknown>
  companyId: string
  canManage: boolean
}) {
  const [open, setOpen] = useState(false)
  const updateRole = useUpdateRole(companyId)
  const currentRole = member.role as string
  const meta = ROLE_LABELS[currentRole] ?? ROLE_LABELS.EMPLOYEE

  if (!canManage) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
        {meta.label}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
          ${meta.color} hover:opacity-80`}
      >
        {meta.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border
            bg-surface shadow-modal py-1">
            <p className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase">Change Role</p>
            {Object.entries(ROLE_LABELS)
              .filter(([r]) => r !== 'COMPANY_OWNER')  // can't promote to owner via this UI
              .map(([roleKey, roleMeta]) => (
              <button
                key={roleKey}
                onClick={() => {
                  updateRole.mutate({
                    memberId:   member.id as string,
                    role:       roleKey,
                    department: member.department as string,
                    jobTitle:   member.jobTitle as string,
                  })
                  setOpen(false)
                }}
                className={`flex w-full flex-col px-3 py-2 text-left hover:bg-surface-2
                  ${roleKey === currentRole ? 'bg-primary/5' : ''}`}
              >
                <span className="text-sm font-medium text-text-primary">{roleMeta.label}</span>
                <span className="text-xs text-text-secondary">{roleMeta.description}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

type Tab = 'directory' | 'performance'

export function EmployeesPage() {
  const [search, setSearch]     = useState('')
  const [tab, setTab]           = useState<Tab>('directory')
  const [inviteOpen, setInvite] = useState(false)
  const [deactivateId, setDeactivate] = useState<string | null>(null)

  const { user } = useAuth()
  const canManage = usePermission('OWNER_ONLY')   // only Owner + Super Admin
  const debounced = useDebounce(search, 350)
  const companyId = user?.companyId ?? ''

  const { data: empData, isLoading, isError, refetch } = useEmployees(debounced)
  const { data: perf, isLoading: perfLoading }          = usePerformance()
  const inviteMutation     = useInviteEmployee(companyId)
  const deactivateMutation = useDeactivateEmployee(companyId)

  const employees = empData?.data ?? []

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} team members`}
        action={
          canManage ? (
            <Button onClick={() => setInvite(true)} size="sm">
              <Plus className="h-4 w-4" /> Invite Employee
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1">
          {(['directory', 'performance'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-sm font-medium capitalize
                ${tab === t ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'directory' && (
        <>
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm"
          />

          {isError   && <ErrorState onRetry={() => refetch()} />}
          {isLoading && <LoadingState />}
          {!isLoading && employees.length === 0 && (
            <EmptyState
              title="No employees yet"
              description={canManage ? 'Invite your first team member.' : 'No team members found.'}
              action={canManage ? <Button onClick={() => setInvite(true)}>Invite Employee</Button> : undefined}
            />
          )}

          {employees.length > 0 && (
            <>
              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {employees.map((m: Record<string, unknown>) => {
                  const u = m.user as Record<string, unknown>
                  return (
                    <div key={m.id as string}
                      className="rounded-lg border border-border bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={u.firstName as string} lastName={u.lastName as string}
                          src={u.avatarUrl as string | null} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {formatFullName(u.firstName as string, u.lastName as string)}
                          </p>
                          <p className="text-xs text-text-secondary truncate">{u.email as string}</p>
                          {!!(m.department as string) && <p className="text-xs text-text-muted">{m.department as string}</p>}
                        </div>
                        <RoleChanger member={m} companyId={companyId} canManage={canManage} />
                      </div>
                      {canManage && (m.role as string) !== 'COMPANY_OWNER' && (
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => setDeactivate(m.id as string)}
                            className="flex items-center gap-1 text-xs text-danger hover:underline"
                          >
                            <UserX className="h-3.5 w-3.5" /> Remove
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
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Last Active</th>
                      {canManage && <th className="px-4 py-3 w-24">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employees.map((m: Record<string, unknown>) => {
                      const u = m.user as Record<string, unknown>
                      return (
                        <tr key={m.id as string} className="hover:bg-surface-2">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar firstName={u.firstName as string} lastName={u.lastName as string}
                                src={u.avatarUrl as string | null} size="sm" />
                              <div>
                                <p className="font-medium text-text-primary">
                                  {formatFullName(u.firstName as string, u.lastName as string)}
                                </p>
                                <p className="text-xs text-text-secondary">{u.email as string}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <RoleChanger member={m} companyId={companyId} canManage={canManage} />
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{(m.department as string) ?? '—'}</td>
                          <td className="px-4 py-3 text-text-secondary">
                            {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt as string) : 'Never'}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3">
                              {(m.role as string) !== 'COMPANY_OWNER' && (
                                <button
                                  onClick={() => setDeactivate(m.id as string)}
                                  className="flex items-center gap-1 text-xs text-danger hover:underline"
                                >
                                  <UserX className="h-3.5 w-3.5" /> Remove
                                </button>
                              )}
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
        </>
      )}

      {tab === 'performance' && (
        <>
          {perfLoading && <LoadingState />}
          {!perfLoading && (
            <>
              {/* Mobile performance cards */}
              <div className="space-y-3 md:hidden">
                {(perf ?? []).map((p: Record<string,unknown>, i: number) => {
                  const emp = p.employee as Record<string,string> | null
                  return (
                    <div key={i} className="rounded-lg border border-border bg-surface p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar firstName={emp?.firstName} lastName={emp?.lastName} size="sm" />
                        <p className="font-medium text-text-primary">
                          {formatFullName(emp?.firstName, emp?.lastName)}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded bg-surface-2 p-2">
                          <p className="font-bold text-text-primary">{p.leadsWon as number}</p>
                          <p className="text-text-muted">Won</p>
                        </div>
                        <div className="rounded bg-surface-2 p-2">
                          <p className="font-bold text-success">${Math.round((p.revenueGenerated as number)/1000)}k</p>
                          <p className="text-text-muted">Revenue</p>
                        </div>
                        <div className="rounded bg-surface-2 p-2">
                          <p className={`font-bold ${(p.conversionRate as number) >= 20 ? 'text-success' : 'text-warning'}`}>
                            {(p.conversionRate as number).toFixed(1)}%
                          </p>
                          <p className="text-text-muted">Rate</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop performance table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3 text-center">Leads Created</th>
                      <th className="px-4 py-3 text-center">Won</th>
                      <th className="px-4 py-3 text-center">Conversion</th>
                      <th className="px-4 py-3">Revenue</th>
                      <th className="px-4 py-3 text-center">Tickets Resolved</th>
                      <th className="px-4 py-3 text-center">Tasks Done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(perf ?? []).map((p: Record<string,unknown>, i: number) => {
                      const emp = p.employee as Record<string,string> | null
                      const cr  = p.conversionRate as number
                      return (
                        <tr key={i} className="hover:bg-surface-2">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar firstName={emp?.firstName} lastName={emp?.lastName} size="sm" />
                              <span className="font-medium text-text-primary">
                                {formatFullName(emp?.firstName, emp?.lastName)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-text-secondary">{p.leadsCreated as number}</td>
                          <td className="px-4 py-3 text-center text-text-secondary">{p.leadsWon as number}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${cr >= 25 ? 'text-success' : cr >= 10 ? 'text-warning' : 'text-danger'}`}>
                              {cr.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            ${((p.revenueGenerated as number)/1000).toFixed(1)}k
                          </td>
                          <td className="px-4 py-3 text-center text-text-secondary">{p.ticketsResolved as number}</td>
                          <td className="px-4 py-3 text-center text-text-secondary">{p.tasksCompleted as number}</td>
                        </tr>
                      )
                    })}
                    {(perf ?? []).length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                        No data for this period.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Invite modal — only shown to Owner/Super Admin */}
      {canManage && (
        <Modal open={inviteOpen} onClose={() => setInvite(false)} title="Invite Team Member">
          <InviteEmployeeForm
            onSubmit={v => inviteMutation.mutate(v as unknown as Record<string,unknown>, {
              onSuccess: () => setInvite(false),
            })}
            onCancel={() => setInvite(false)}
            loading={inviteMutation.isPending}
          />
          {inviteMutation.isError && (
            <p className="mt-2 text-sm text-danger">
              Failed to invite. The email may already be a member.
            </p>
          )}
        </Modal>
      )}

      {/* Deactivate confirm — only shown to Owner/Super Admin */}
      {canManage && (
        <ConfirmDialog
          open={!!deactivateId}
          title="Remove employee?"
          description="This will deactivate their access. Their data and history will be preserved."
          confirmLabel="Remove"
          variant="danger"
          loading={deactivateMutation.isPending}
          onConfirm={() => {
            if (deactivateId) {
              deactivateMutation.mutate(deactivateId, { onSuccess: () => setDeactivate(null) })
            }
          }}
          onCancel={() => setDeactivate(null)}
        />
      )}
    </div>
  )
}
