import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/FormControls'
import { Avatar } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/States'
import {
  User, Lock, Bell, Building2, Mail, Download,
  Shield, Trash2, LogOut, CheckCircle2, AlertCircle,
  Smartphone, Globe, Clock, ChevronRight,
  MessageCircle, Github, Link2, Users,
} from 'lucide-react'

// ── Shared save feedback ──────────────────────────────────────

function SaveFeedback({ isSuccess, isError, successMsg = 'Saved successfully.', errorMsg = 'Save failed. Please try again.' }: {
  isSuccess: boolean; isError: boolean; successMsg?: string; errorMsg?: string
}) {
  if (!isSuccess && !isError) return null
  return (
    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm
      ${isSuccess ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
      {isSuccess
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <AlertCircle  className="h-4 w-4 shrink-0" />}
      {isSuccess ? successMsg : errorMsg}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: My Profile
// ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn:  () => api.get('/settings/profile').then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch('/settings/profile', body).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'profile'] })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    values: data
      ? {
          firstName: data.firstName ?? '',
          lastName:  data.lastName  ?? '',
          phone:     data.phone     ?? '',
          timezone:  data.timezone  ?? 'UTC',
          language:  data.language  ?? 'en',
        }
      : undefined,
  })

  if (isLoading) return <LoadingState />

  const membership = data?.memberships?.[0]

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Avatar */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
        <Avatar firstName={data?.firstName} lastName={data?.lastName}
          src={data?.avatarUrl} size="lg" />
        <div>
          <p className="font-semibold text-text-primary">
            {data?.firstName} {data?.lastName}
          </p>
          <p className="text-sm text-text-secondary">{data?.email}</p>
          {membership && (
            <p className="mt-1 text-xs font-medium text-primary">
              {membership.role?.replace('_', ' ')}
              {membership.jobTitle ? ` · ${membership.jobTitle}` : ''}
              {membership.department ? ` · ${membership.department}` : ''}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              // For now store as data URL — in production upload to S3
              const reader = new FileReader()
              reader.onload = ev => {
                mutation.mutate({ avatarUrl: ev.target?.result as string })
              }
              reader.readAsDataURL(file)
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Change photo
          </Button>
        </div>
      </div>

      {/* Info form */}
      <form onSubmit={handleSubmit(v => mutation.mutate(v as Record<string, unknown>))}
        className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Personal Information</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" {...register('firstName')} />
          <Input label="Last name"  {...register('lastName')} />
        </div>

        <Input label="Phone number" type="tel" placeholder="+260 97 000 0000"
          {...register('phone')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Timezone" {...register('timezone')}>
            <option value="Africa/Lusaka">Africa/Lusaka (CAT)</option>
            <option value="Africa/Harare">Africa/Harare (CAT)</option>
            <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
            <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            <option value="UTC">UTC</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
          </Select>
          <Select label="Language" {...register('language')}>
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
          </Select>
        </div>

        <div className="flex items-center justify-between pt-1">
          <SaveFeedback isSuccess={mutation.isSuccess} isError={mutation.isError} />
          <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>

      {/* Read-only account info */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Account Information</h3>
        <InfoRow icon={Mail}  label="Email address" value={data?.email} />
        <InfoRow icon={Clock} label="Member since"  value={data?.createdAt ? new Date(data.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric'}) : '—'} />
        <InfoRow icon={Clock} label="Last login"    value={data?.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : 'Never'} />
        <p className="text-xs text-text-muted pt-1">
          To change your email address, contact your company administrator.
        </p>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm font-medium text-text-primary">{value ?? '—'}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Security & Password
// ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const qc = useQueryClient()

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['settings', 'sessions'],
    queryFn:  () => api.get('/settings/security/sessions').then(r => r.data.data),
  })

  const changePasswordMutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/me/password', body),
  })

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/security/sessions/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'sessions'] }),
  })

  const revokeAllMutation = useMutation({
    mutationFn: () => api.delete('/settings/security/sessions'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'sessions'] }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string
  }>()

  const onChangePassword = (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) return
    changePasswordMutation.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => reset() }
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Change password */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Change Password</h3>
        </div>

        <form onSubmit={handleSubmit(onChangePassword)} className="space-y-3">
          <Input label="Current password" type="password"
            {...register('currentPassword', { required: 'Required' })}
            error={errors.currentPassword?.message} />
          <Input label="New password" type="password"
            {...register('newPassword', {
              required: 'Required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
              pattern: {
                value: /^(?=.*[A-Z])(?=.*[0-9])/,
                message: 'Must include at least one uppercase letter and one number'
              }
            })}
            error={errors.newPassword?.message} />
          <Input label="Confirm new password" type="password"
            {...register('confirmPassword', { required: 'Required' })}
            error={errors.confirmPassword?.message} />

          <div className="rounded-md bg-surface-2 p-3 text-xs text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">Password requirements:</p>
            <p>• Minimum 8 characters</p>
            <p>• At least one uppercase letter</p>
            <p>• At least one number</p>
          </div>

          <div className="flex items-center justify-between">
            <SaveFeedback
              isSuccess={changePasswordMutation.isSuccess}
              isError={changePasswordMutation.isError}
              successMsg="Password updated successfully."
              errorMsg="Incorrect current password or invalid new password."
            />
            <Button type="submit" loading={changePasswordMutation.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </div>

      {/* Active sessions */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Active Sessions</h3>
          </div>
          <Button variant="danger" size="sm" onClick={() => revokeAllMutation.mutate()}
            loading={revokeAllMutation.isPending}>
            <LogOut className="h-3.5 w-3.5" /> Sign out all
          </Button>
        </div>

        {sessionsLoading && <LoadingState />}

        <div className="divide-y divide-border">
          {(sessions ?? []).map((s: Record<string, unknown>, i: number) => (
            <div key={s.id as string} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Session {i === 0 ? '(current)' : `#${i + 1}`}
                </p>
                <p className="text-xs text-text-secondary">
                  Started {new Date(s.createdAt as string).toLocaleString()} ·
                  Expires {new Date(s.expiresAt as string).toLocaleDateString()}
                </p>
              </div>
              {i !== 0 && (
                <button
                  onClick={() => revokeSessionMutation.mutate(s.id as string)}
                  className="text-xs text-danger hover:underline"
                >
                  Revoke
                </button>
              )}
              {i === 0 && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  Active
                </span>
              )}
            </div>
          ))}
          {!sessionsLoading && (sessions ?? []).length === 0 && (
            <p className="py-4 text-sm text-text-secondary">No active sessions found.</p>
          )}
        </div>
      </div>

      {/* Security tips */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Security Tips</h3>
        </div>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />Use a unique password not used on other sites</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />Sign out of sessions on devices you no longer use</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />Never share your password with anyone, including administrators</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />Change your password if you suspect it has been compromised</li>
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Notification Preferences
// ─────────────────────────────────────────────────────────────

function NotificationsTab() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notif-prefs'],
    queryFn:  () => api.get('/settings/notifications/preferences').then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch('/settings/notifications/preferences', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'notif-prefs'] }),
  })

  const toggle = (key: string, current: boolean) => {
    mutation.mutate({ [key]: !current })
  }

  if (isLoading) return <LoadingState />

  const prefs = data ?? {}

  return (
    <div className="space-y-6 max-w-2xl">
      <NotifSection
        title="Email Notifications"
        description="Receive email alerts for important events"
        icon={Mail}
        items={[
          { key: 'emailOnLeadAssigned',   label: 'Lead assigned to me',   desc: 'When a lead is assigned to you' },
          { key: 'emailOnTicketAssigned', label: 'Ticket assigned to me', desc: 'When a support ticket is assigned to you' },
          { key: 'emailOnTaskAssigned',   label: 'Task assigned to me',   desc: 'When a task is assigned to you' },
          { key: 'emailOnMention',        label: 'Mentions',              desc: 'When someone mentions you in a note or comment' },
        ]}
        prefs={prefs}
        onToggle={toggle}
      />

      <NotifSection
        title="In-App Notifications"
        description="Alerts shown inside the CRM notification centre"
        icon={Bell}
        items={[
          { key: 'inAppLeadUpdates',   label: 'Lead updates',   desc: 'Stage changes on your leads' },
          { key: 'inAppTicketUpdates', label: 'Ticket updates', desc: 'Replies and status changes on your tickets' },
          { key: 'inAppTaskUpdates',   label: 'Task updates',   desc: 'Comments and status changes on your tasks' },
        ]}
        prefs={prefs}
        onToggle={toggle}
      />

      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-text-secondary" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Email Digest</h3>
            <p className="text-xs text-text-secondary">Summary emails with your activity overview</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['NONE', 'DAILY', 'WEEKLY'] as const).map(freq => (
            <button
              key={freq}
              onClick={() => mutation.mutate({ digestFrequency: freq })}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors
                ${prefs.digestFrequency === freq
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-secondary hover:border-primary/40'}`}
            >
              {freq === 'NONE' ? 'No digest' : freq === 'DAILY' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>
        <SaveFeedback isSuccess={mutation.isSuccess} isError={mutation.isError} />
      </div>
    </div>
  )
}

function NotifSection({ title, description, icon: Icon, items, prefs, onToggle }: {
  title: string; description: string; icon: React.ElementType
  items: { key: string; label: string; desc: string }[]
  prefs: Record<string, unknown>
  onToggle: (key: string, current: boolean) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-secondary" />
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {items.map(item => {
          const enabled = prefs[item.key] !== false
          return (
            <div key={item.key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{item.label}</p>
                <p className="text-xs text-text-secondary">{item.desc}</p>
              </div>
              <button
                onClick={() => onToggle(item.key, enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2
                  border-transparent transition-colors duration-200
                  ${enabled ? 'bg-primary' : 'bg-surface-3'}`}
                role="switch"
                aria-checked={enabled}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full
                  bg-white shadow transition duration-200
                  ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Company Settings (Owner only)
// ─────────────────────────────────────────────────────────────

function CompanyTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn:  () => api.get('/settings').then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/settings', body),
  })

  const { register, handleSubmit } = useForm({ values: data ?? {} })

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={handleSubmit(v => mutation.mutate(v as Record<string, unknown>))}
        className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Company Information</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Company name" {...register('name')} />
          <Input label="Email"        {...register('email')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Phone"   {...register('phone')} />
          <Input label="Website" {...register('website')} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Currency" {...register('currency')}>
            <option value="USD">USD — US Dollar</option>
            <option value="ZMW">ZMW — Zambian Kwacha</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="ZAR">ZAR — South African Rand</option>
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="NGN">NGN — Nigerian Naira</option>
          </Select>
          <Select label="Date format" {...register('dateFormat')}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </Select>
          <Select label="Language" {...register('language')}>
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Working hours start" type="time" {...register('workingHoursStart')} />
          <Input label="Working hours end"   type="time" {...register('workingHoursEnd')} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <SaveFeedback isSuccess={mutation.isSuccess} isError={mutation.isError} />
          <Button type="submit" loading={mutation.isPending}>Save company settings</Button>
        </div>
      </form>

      {data?.slug && <CustomerPortalCard slug={data.slug} />}
    </div>
  )
}

function CustomerPortalCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const portalUrl = `${window.location.origin}/portal/${slug}/login`

  const copy = async () => {
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">Customer Self-Service Portal</h3>
      <p className="text-sm text-text-secondary">
        Share this link with your customers so they can open support tickets and check on them without calling in — no password required, they sign in with a one-time email link.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-secondary">{portalUrl}</code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Email / SMTP
// ─────────────────────────────────────────────────────────────

function EmailTab() {
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/settings/email', body),
  })
  const testMutation = useMutation({
    mutationFn: () => api.post('/settings/email/test'),
  })

  const { register, handleSubmit } = useForm()

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={handleSubmit(v => mutation.mutate(v as Record<string, unknown>))}
        className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-text-secondary" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">SMTP Configuration</h3>
            <p className="text-xs text-text-secondary">Used for password resets, notifications, and system emails</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input label="SMTP Host" placeholder="smtp.sendgrid.net" {...register('smtpHost')} />
          </div>
          <Input label="Port" type="number" placeholder="587" {...register('smtpPort')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Username / API Key" {...register('smtpUser')} />
          <Input label="Password" type="password" placeholder="••••••••"
            {...(register as (name: string) => object)('smtpPass')} />
        </div>

        <Input label="From address" placeholder="noreply@yourcompany.com" {...register('smtpFrom')} />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" loading={mutation.isPending}>Save SMTP</Button>
          <Button type="button" variant="secondary" onClick={() => testMutation.mutate()}
            loading={testMutation.isPending}>
            Send test email
          </Button>
          <div className="flex-1">
            <SaveFeedback isSuccess={mutation.isSuccess} isError={mutation.isError} />
            {testMutation.isSuccess && <p className="text-sm text-success">Test email sent — check your inbox.</p>}
            {testMutation.isError   && <p className="text-sm text-danger">Test failed — check your SMTP credentials.</p>}
          </div>
        </div>

        <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-text-secondary">
          <p className="font-medium text-text-primary mb-1">Development mode</p>
          <p>All emails are captured by Mailpit. Open <a href="http://localhost:8025" target="_blank"
            className="text-primary underline">localhost:8025</a> to view them. No real emails are sent.</p>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: Data Import & Export
// ─────────────────────────────────────────────────────────────

function DataTab() {
  const [exporting, setExporting] = useState<string | null>(null)

  const EXPORTS = [
    { entity: 'customers',     label: 'Customers',     desc: 'Name, email, phone, company, status, tags' },
    { entity: 'leads',         label: 'Leads',         desc: 'Title, stage, value, probability, source' },
    { entity: 'opportunities', label: 'Opportunities', desc: 'Title, stage, expected revenue, probability' },
    { entity: 'tickets',       label: 'Support Tickets', desc: 'Ticket number, title, status, priority' },
    { entity: 'tasks',         label: 'Tasks',         desc: 'Title, status, priority, due date' },
  ]

  const handleExport = async (entity: string) => {
    setExporting(entity)
    try {
      const response = await api.get(`/settings/export/${entity}`, { responseType: 'blob' })
      const url  = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', `${entity}-export-${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Export */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-text-secondary" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Export Data</h3>
            <p className="text-xs text-text-secondary">Download your data as CSV files</p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {EXPORTS.map(item => (
            <div key={item.entity} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{item.label}</p>
                <p className="text-xs text-text-secondary">{item.desc}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={exporting === item.entity}
                onClick={() => handleExport(item.entity)}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Import placeholder */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-text-secondary rotate-180" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Import Data</h3>
            <p className="text-xs text-text-secondary">Bulk import customers and leads from CSV</p>
          </div>
        </div>

        <div className="rounded-md border-2 border-dashed border-border p-8 text-center">
          <Download className="mx-auto h-8 w-8 rotate-180 text-text-muted mb-2" />
          <p className="text-sm font-medium text-text-primary">CSV Import</p>
          <p className="text-xs text-text-secondary mt-1">Coming soon — bulk import for customers and leads</p>
        </div>

        <div className="rounded-md bg-surface-2 p-3 text-xs text-text-secondary space-y-1">
          <p className="font-medium text-text-primary">Import tips:</p>
          <p>• Export your data first to see the required column format</p>
          <p>• Required fields: firstName, lastName, email (for customers)</p>
          <p>• Duplicate emails will be skipped</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: About
// ─────────────────────────────────────────────────────────────

function AboutTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-border bg-surface p-6 text-center space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-raised">
          C
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">CRM Platform</h2>
          <p className="text-sm text-text-secondary">Enterprise Customer Relationship Management</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          All systems operational
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">What's included</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
          {[
            'Customer management', 'Lead pipeline (Kanban)',
            'Opportunity tracking', 'Support ticket system',
            'Customer self-service portal', 'Task management',
            'Calendar & scheduling', 'Employee directory',
            'Reports & analytics', 'Global search',
            'Dark mode', 'Role-based access',
            'Audit logging', 'Email notifications',
            'CSV import & export', 'Multi-company support',
          ].map(f => (
            <div key={f} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Users className="h-4 w-4" /> The Team
        </h3>

        <div className="space-y-3">
          <div>
            <p className="font-medium text-text-primary">Peter Zulu</p>
            <p className="text-xs text-text-secondary">Developer</p>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
              <a href="https://wa.me/260773492163" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-text-secondary hover:text-primary">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a href="https://facebook.com/myron2110" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-text-secondary hover:text-primary">
                <Link2 className="h-3.5 w-3.5" /> Facebook
              </a>
              <a href="https://github.com/petalo12110" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-text-secondary hover:text-primary">
                <Github className="h-3.5 w-3.5" /> GitHub
              </a>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="font-medium text-text-primary">Florence Malimakau</p>
            <p className="text-xs text-text-secondary">Advisor &amp; Manager</p>
          </div>

          <div className="border-t border-border pt-3">
            <p className="font-medium text-text-primary">Elvis</p>
            <p className="text-xs text-text-secondary">Support &amp; Co-developer</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Roadmap</h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          {[
            'Mobile app (React Native + Capacitor)',
            'Google Calendar & Gmail sync',
            'Stripe payment integration',
            'PDF report export',
            'AI-powered lead scoring',
            'WhatsApp Business integration',
          ].map(item => (
            <li key={item} className="flex items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────────────────────

type SettingsTab = 'profile' | 'security' | 'notifications' | 'company' | 'email' | 'data' | 'about'

interface TabDef {
  key:      SettingsTab
  label:    string
  icon:     React.ElementType
  requires?: string   // permission group
}

const TABS: TabDef[] = [
  { key: 'profile',       label: 'My Profile',         icon: User },
  { key: 'security',      label: 'Security',           icon: Lock },
  { key: 'notifications', label: 'Notifications',      icon: Bell },
  { key: 'company',       label: 'Company',            icon: Building2,  requires: 'OWNER_ONLY' },
  { key: 'email',         label: 'Email / SMTP',       icon: Mail,       requires: 'OWNER_ONLY' },
  { key: 'data',          label: 'Data & Export',      icon: Download,   requires: 'MANAGEMENT' },
  { key: 'about',         label: 'About',              icon: Shield },
]

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const canOwner = usePermission('OWNER_ONLY')
  const canMgmt  = usePermission('MANAGEMENT')

  const visibleTabs = TABS.filter(t => {
    if (t.requires === 'OWNER_ONLY') return canOwner
    if (t.requires === 'MANAGEMENT') return canMgmt
    return true
  })

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Settings" subtitle="Manage your account and company configuration" />

      <div className="mt-4 flex flex-col gap-6 md:flex-row">
        {/* Sidebar nav */}
        <aside className="md:w-52 shrink-0">
          {/* Mobile: horizontal scroll tabs */}
          <nav className="flex gap-1 overflow-x-auto pb-1 md:hidden">
            {visibleTabs.map(t => {
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap
                    ${tab === t.key ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3'}`}>
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </nav>

          {/* Desktop: vertical sidebar */}
          <nav className="hidden md:flex flex-col gap-0.5">
            {visibleTabs.map(t => {
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-left
                    ${tab === t.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'profile'       && <ProfileTab />}
          {tab === 'security'      && <SecurityTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'company'       && canOwner && <CompanyTab />}
          {tab === 'email'         && canOwner && <EmailTab />}
          {tab === 'data'          && canMgmt  && <DataTab />}
          {tab === 'about'         && <AboutTab />}
        </div>
      </div>
    </div>
  )
}
