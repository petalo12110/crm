import { ReactNode } from 'react'
import { getStatusColor, formatInitials } from '@/lib/formatters'

// ── Badge ────────────────────────────────────────────────────

export function Badge({ children, status, className = '' }: { children: ReactNode; status?: string; className?: string }) {
  const colorClass = status ? getStatusColor(status) : 'bg-surface-3 text-text-secondary'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass} ${className}`}>
      {children}
    </span>
  )
}

// ── Avatar ───────────────────────────────────────────────────

interface AvatarProps {
  firstName?: string | null
  lastName?:  string | null
  src?:       string | null
  size?:      'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = { sm: 'h-6 w-6 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' }

export function Avatar({ firstName, lastName, src, size = 'md' }: AvatarProps) {
  if (src) {
    return <img src={src} alt="" className={`rounded-full object-cover ${SIZE_CLASSES[size]}`} />
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/10 font-medium text-primary ${SIZE_CLASSES[size]}`}>
      {formatInitials(firstName, lastName)}
    </div>
  )
}
