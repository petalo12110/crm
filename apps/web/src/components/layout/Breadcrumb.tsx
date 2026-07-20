import { ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function Breadcrumb() {
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)

  if (parts.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-5 py-2 text-sm text-text-secondary">
      <Link to="/dashboard" className="hover:text-text-primary">Home</Link>
      {parts.map((part, i) => {
        const path = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ')
        return (
          <span key={path} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
            {isLast
              ? <span className="text-text-primary">{label}</span>
              : <Link to={path} className="hover:text-text-primary">{label}</Link>}
          </span>
        )
      })}
    </div>
  )
}

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
