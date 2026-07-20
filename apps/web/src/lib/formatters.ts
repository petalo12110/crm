import { format, formatDistanceToNow, isValid } from 'date-fns'

export function formatCurrency(amount: number | string | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '—'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num)
}

export function formatDate(date: string | Date | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (!isValid(d)) return '—'
  return format(d, pattern)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, 'MMM d, yyyy h:mm a')
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (!isValid(d)) return '—'
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.[0] ?? ''
  const l = lastName?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed'
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  return phone
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:        'bg-success/10 text-success',
  INACTIVE:      'bg-text-muted/10 text-text-muted',
  PROSPECT:      'bg-primary/10 text-primary',
  BLOCKED:       'bg-danger/10 text-danger',
  NEW:           'bg-primary/10 text-primary',
  CONTACTED:     'bg-warning/10 text-warning',
  QUALIFIED:     'bg-primary/10 text-primary',
  PROPOSAL_SENT: 'bg-warning/10 text-warning',
  NEGOTIATION:   'bg-warning/10 text-warning',
  WON:           'bg-success/10 text-success',
  LOST:          'bg-danger/10 text-danger',
  ARCHIVED:      'bg-text-muted/10 text-text-muted',
  OPEN:          'bg-primary/10 text-primary',
  IN_PROGRESS:   'bg-warning/10 text-warning',
  ON_HOLD:       'bg-text-muted/10 text-text-muted',
  RESOLVED:      'bg-success/10 text-success',
  CLOSED:        'bg-text-muted/10 text-text-muted',
  COMPLETED:     'bg-success/10 text-success',
  CANCELLED:     'bg-danger/10 text-danger',
  LOW:           'bg-text-muted/10 text-text-muted',
  MEDIUM:        'bg-primary/10 text-primary',
  HIGH:          'bg-warning/10 text-warning',
  URGENT:        'bg-danger/10 text-danger',
  CRITICAL:      'bg-danger/10 text-danger',
  // Subscription statuses
  TRIALING:      'bg-primary/10 text-primary',
  PAST_DUE:      'bg-warning/10 text-warning',
  SUSPENDED:     'bg-danger/10 text-danger',
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-text-muted/10 text-text-muted'
}
