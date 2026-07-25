import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Building2, Mail, Plus, CheckCircle2, AlertCircle,
  Send, Eye, EyeOff, ShieldCheck, Copy, Check,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/FormControls'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Overlay'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { formatDate } from '@/lib/formatters'
import { adminApi, SmtpSettingsInput } from '../api/admin.api'

type Tab = 'companies' | 'email'

export function SuperAdminPage() {
  const [tab, setTab] = useState<Tab>('companies')

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Super Admin" subtitle="Platform-wide management — companies and system email" />

      <nav className="mt-5 flex gap-1 border-b border-border">
        <TabButton active={tab === 'companies'} onClick={() => setTab('companies')} icon={Building2}>
          Companies
        </TabButton>
        <TabButton active={tab === 'email'} onClick={() => setTab('email')} icon={Mail}>
          Email (SMTP)
        </TabButton>
      </nav>

      <div className="mt-5">
        {tab === 'companies' ? <CompaniesTab /> : <SmtpTab />}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors
        ${active ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  )
}

/** Monospace ID with a one-click copy button — used everywhere a raw
 * company/entity ID needs to be handed to someone (e.g. pasted into the
 * company login form), so nobody has to go query the database for it. */
function CopyableId({ id, label }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      title="Copy ID"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-text-secondary hover:border-primary hover:text-primary"
    >
      {label && <span className="font-sans text-text-muted">{label}:</span>}
      {id}
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Companies
// ─────────────────────────────────────────────────────────────

interface CreateCompanyValues {
  name:     string
  email?:   string
  phone?:   string
  country?: string
  timezone: string
  currency: string
  planTier: string
  ownerFirstName: string
  ownerLastName:  string
  ownerEmail:     string
}

function CompaniesTab() {
  const [createOpen, setCreateOpen] = useState(false)
  const [justCreated, setJustCreated] = useState<{ id: string; name: string; ownerEmail: string } | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'companies'],
    queryFn:  () => adminApi.listCompanies({ limit: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateCompanyValues) => {
      const { ownerFirstName, ownerLastName, ownerEmail, ...companyFields } = values
      return adminApi.createCompany({
        ...companyFields,
        owner: { firstName: ownerFirstName, lastName: ownerLastName, email: ownerEmail },
      }).then(company => ({ company, ownerEmail }))
    },
    onSuccess: ({ company, ownerEmail }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] })
      setCreateOpen(false)
      // The company ID is the one thing you actually need right after
      // creating it (to hand to the owner, or to log in and check on it)
      // and previously it was returned by the API but never shown
      // anywhere in the UI — surface it front and center instead of
      // making anyone go query the database for it.
      setJustCreated({ id: company.id, name: company.name, ownerEmail })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateCompany(id, { subscriptionStatus: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'companies'] }),
  })

  const companies = data?.data ?? []
  const totalMembers = companies.reduce((sum: number, c: Record<string, unknown>) =>
    sum + ((c._count as Record<string, number> | undefined)?.members ?? 0), 0)
  const activeSubs = companies.filter((c: Record<string, unknown>) =>
    (c.subscription as Record<string, unknown> | undefined)?.status === 'ACTIVE').length

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState message="Couldn't load companies." onRetry={refetch} />

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-6">
          <Stat label="Companies" value={String(companies.length)} />
          <Stat label="Active subscriptions" value={String(activeSubs)} />
          <Stat label="Total members" value={String(totalMembers)} />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New company
        </Button>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Create the first company to get started."
          icon={<Building2 className="h-10 w-10" />}
          action={<Button size="sm" onClick={() => setCreateOpen(true)}>New company</Button>}
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Customers</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((c: Record<string, unknown>) => {
                  const counts = c._count as Record<string, number> | undefined
                  const sub    = c.subscription as Record<string, unknown> | undefined
                  const name   = c.name as string
                  return (
                    <tr key={c.id as string} className="hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">{name}</p>
                            <p className="text-xs text-text-muted">{c.email as string ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CopyableId id={c.id as string} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge status={sub?.status as string ?? 'default'}>{(sub?.planTier as string) ?? 'FREE'}</Badge>
                          <select
                            value={(sub?.status as string) ?? 'TRIALING'}
                            onChange={e => statusMutation.mutate({ id: c.id as string, status: e.target.value })}
                            disabled={statusMutation.isPending}
                            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-text-secondary hover:border-primary"
                            title="Change subscription status"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="TRIALING">Trialing</option>
                            <option value="PAST_DUE">Past due</option>
                            <option value="SUSPENDED">Suspended</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{counts?.members ?? 0}</td>
                      <td className="px-4 py-3 text-text-secondary">{counts?.customers ?? 0}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(c.createdAt as string)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New company">
        <CreateCompanyForm
          loading={createMutation.isPending}
          error={createMutation.isError ? "Couldn't create the company or its owner — check the fields and try again." : undefined}
          onSubmit={values => createMutation.mutate(values)}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal open={!!justCreated} onClose={() => setJustCreated(null)} title="Company created" size="sm">
        {justCreated && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span><strong>{justCreated.name}</strong> is ready.</span>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase text-text-muted">Company ID</p>
              <CopyableId id={justCreated.id} />
              <p className="mt-1.5 text-xs text-text-secondary">
                Needed to log in as this company — paste it into the "Company ID" field on the login page.
              </p>
            </div>
            <p className="text-sm text-text-secondary">
              An invite email was sent to <strong>{justCreated.ownerEmail}</strong> with a link to set their password.
            </p>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setJustCreated(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function CreateCompanyForm({ onSubmit, onCancel, loading, error }: {
  onSubmit: (values: CreateCompanyValues) => void
  onCancel: () => void
  loading?: boolean
  error?:   string
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateCompanyValues>({
    defaultValues: { timezone: 'UTC', currency: 'USD', planTier: 'FREE' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Input label="Company name" {...register('name', { required: 'Company name is required' })} error={errors.name?.message} />
      <Input label="Contact email (optional)" type="email" {...register('email')} error={errors.email?.message} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Phone (optional)" {...register('phone')} />
        <Input label="Country code (optional)" placeholder="US" maxLength={2} {...register('country')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Timezone" {...register('timezone')} />
        <Input label="Currency" maxLength={3} {...register('currency')} />
      </div>

      <div>
        <Select label="Subscription plan" {...register('planTier')}>
          <option value="FREE">Free — 5 users, 500 customers, 5GB</option>
          <option value="STARTER">Starter — 15 users, 2,500 customers, 20GB</option>
          <option value="PROFESSIONAL">Professional — 50 users, 10,000 customers, 100GB</option>
          <option value="ENTERPRISE">Enterprise — 500 users, 100,000 customers, 1TB</option>
        </Select>
        <p className="mt-1 text-xs text-text-secondary">Can be changed later from the company's settings.</p>
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm font-medium text-text-primary">Company Owner</p>
        <p className="mb-3 text-xs text-text-secondary">
          Every company needs an owner to actually log in and use it — they'll get an email with a link to set their password, same as inviting an employee.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" {...register('ownerFirstName', { required: 'Required' })} error={errors.ownerFirstName?.message} />
          <Input label="Last name"  {...register('ownerLastName',  { required: 'Required' })} error={errors.ownerLastName?.message} />
        </div>
        <Input
          label="Owner email"
          type="email"
          className="mt-3"
          {...register('ownerEmail', { required: 'Required' })}
          error={errors.ownerEmail?.message}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Create company</Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Email (SMTP)
// ─────────────────────────────────────────────────────────────

const PROVIDER_PRESETS = [
  { label: 'Custom / other',          host: '',                port: 587, secure: false },
  { label: 'Mailpit (local dev)',     host: 'localhost',        port: 1025, secure: false },
  { label: 'Gmail',                   host: 'smtp.gmail.com',   port: 587, secure: false },
  { label: 'SendGrid',                host: 'smtp.sendgrid.net',port: 587, secure: false },
  { label: 'Mailgun',                 host: 'smtp.mailgun.org', port: 587, secure: false },
  { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false },
]

function SmtpTab() {
  const qc = useQueryClient()
  const [showPass, setShowPass] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'smtp-settings'],
    queryFn:  adminApi.getSmtpSettings,
  })

  const { register, handleSubmit, watch, setValue, formState: { isDirty } } = useForm<SmtpSettingsInput>({
    values: data ? {
      host: data.host ?? '', port: data.port ?? 587, secure: data.secure ?? false,
      user: data.user ?? '', pass: '', emailFrom: data.emailFrom ?? '',
    } : undefined,
  })

  const saveMutation = useMutation({
    mutationFn: (body: SmtpSettingsInput) => adminApi.updateSmtpSettings(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'smtp-settings'] }),
  })

  const testMutation = useMutation({
    mutationFn: (recipient: string) => adminApi.testSmtpSettings(recipient, watch()),
    onSuccess:  result => setTestResult(result),
    onError:    () => setTestResult({ success: false, error: 'Request failed — check the API is reachable.' }),
  })

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState message="Couldn't load SMTP settings." onRetry={refetch} />

  const applyPreset = (host: string, port: number, secure: boolean) => {
    setValue('host', host, { shouldDirty: true })
    setValue('port', port, { shouldDirty: true })
    setValue('secure', secure, { shouldDirty: true })
  }

  return (
    <div className="max-w-xl space-y-5">
      {!data.configured && (
        <div className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No SMTP configured yet — the platform falls back to whatever <code className="text-xs">SMTP_HOST</code> is set to in the environment (Mailpit in local dev). Save settings below to override it, without restarting anything.</span>
        </div>
      )}

      <form onSubmit={handleSubmit(body => { saveMutation.mutate(body); setTestResult(null) })} className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">SMTP configuration</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium
            ${data.configured ? 'bg-success/10 text-success' : 'bg-surface-3 text-text-muted'}`}>
            {data.configured ? 'Configured' : 'Not configured'}
          </span>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Quick setup</label>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_PRESETS.map(p => {
              const isActive = p.host !== '' && watch('host') === p.host
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.host, p.port, p.secure)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
                    ${isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-strong text-text-secondary hover:border-primary hover:text-primary'}`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-4">

        <Input label="SMTP host" placeholder="smtp.gmail.com" {...register('host', { required: true })} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Port" type="number" {...register('port', { required: true, valueAsNumber: true })} />
          <Select label="Encryption" {...register('secure', {
            setValueAs: v => v === 'true',
          })}>
            <option value="false">STARTTLS (587) — most providers</option>
            <option value="true">SSL/TLS (465)</option>
          </Select>
        </div>

        <Input label="Username" placeholder="you@gmail.com" autoComplete="off" {...register('user')} />

        <div className="relative">
          <Input
            label="Password"
            type={showPass ? 'text' : 'password'}
            placeholder={data.hasPassword ? 'Saved — leave blank to keep it' : 'App password or SMTP password'}
            autoComplete="new-password"
            {...register('pass')}
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="absolute right-2.5 top-[30px] text-text-muted hover:text-text-primary"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {watch('host')?.includes('gmail') && (
          <p className="text-xs text-text-muted">
            Gmail requires an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary hover:underline">App Password</a> — your regular Gmail password won't work here (Google blocks plain SMTP logins).
          </p>
        )}

        <Input label="From address" placeholder="noreply@yourcompany.com" type="email" {...register('emailFrom', { required: true })} />

        {saveMutation.isSuccess && (
          <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Saved. The worker will pick this up on the next email — no restart needed.
          </div>
        )}
        {saveMutation.isError && (
          <div className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> Couldn't save. Check the fields above.
          </div>
        )}

        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="submit" loading={saveMutation.isPending} disabled={!isDirty}>Save settings</Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Send className="h-4 w-4" /> Send a test email
        </h3>
        <p className="mb-3 text-sm text-text-secondary">
          Tests whatever is currently in the form above (saved or not), so you can verify before committing.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="you@example.com"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="secondary"
            loading={testMutation.isPending}
            disabled={!testEmail}
            onClick={() => { setTestResult(null); testMutation.mutate(testEmail) }}
          >
            Send test
          </Button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm
            ${testResult.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {testResult.success
              ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{testResult.success ? 'Sent! Check the inbox (or Mailpit at localhost:8025 in local dev).' : testResult.error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
