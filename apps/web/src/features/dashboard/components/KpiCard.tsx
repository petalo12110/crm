import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  title:    string
  value:    string | number
  subtitle?:string
  change?:  number   // percentage, positive = good, negative = bad
  icon?:    ReactNode
  accent?:  'default' | 'warning' | 'danger' | 'success'
}

const ACCENTS = {
  default: 'border-border',
  warning: 'border-warning/30',
  danger:  'border-danger/30',
  success: 'border-success/30',
}

export function KpiCard({ title, value, subtitle, change, icon, accent = 'default' }: KpiCardProps) {
  return (
    <div className={`rounded-lg border ${ACCENTS[accent]} bg-surface p-4 shadow-raised`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
        </div>
        {icon && <div className="rounded-lg bg-surface-3 p-2 text-text-secondary">{icon}</div>}
      </div>
      {change !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-success' : 'text-danger'}`}>
          {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(change).toFixed(1)}% vs last month
        </div>
      )}
    </div>
  )
}
