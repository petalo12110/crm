import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Target, Briefcase, CheckSquare,
  Calendar, Ticket, UserCog, BarChart3, Settings, TrendingUp,
  Menu, X,
} from 'lucide-react'
import { usePermission, checkPermission } from '@/hooks/usePermission'
import { useAuth } from '@/context/AuthContext'

interface NavItem {
  to:       string
  label:    string
  icon:     React.ElementType
  requires?: string
}

const MAIN_NAV: NavItem[] = [
  { to: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/customers',     label: 'Customers',     icon: Users },
  { to: '/leads',         label: 'Leads',         icon: Target,     requires: 'SALES' },
  { to: '/opportunities', label: 'Opportunities', icon: TrendingUp, requires: 'SALES' },
  { to: '/tasks',         label: 'Tasks',         icon: CheckSquare },
  { to: '/calendar',      label: 'Calendar',      icon: Calendar },
]

const SUPPORT_NAV: NavItem[] = [
  { to: '/tickets',   label: 'Tickets',   icon: Ticket,  requires: 'SUPPORT' },
  { to: '/employees', label: 'Employees', icon: UserCog, requires: 'MANAGEMENT' },
]

const INSIGHTS_NAV: NavItem[] = [
  { to: '/reports', label: 'Reports', icon: BarChart3, requires: 'MANAGEMENT' },
]

const BOTTOM_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Home',      icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/leads',     label: 'Leads',     icon: Target,     requires: 'SALES' },
  { to: '/tasks',     label: 'Tasks',     icon: CheckSquare },
  { to: '/tickets',   label: 'Tickets',   icon: Ticket,     requires: 'SUPPORT' },
]

function NavSection({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate?: () => void }) {
  const { user } = useAuth()
  const anyVisible = items.some(item => checkPermission(user?.role, item.requires ?? 'ALL'))
  if (!anyVisible) return null
  return (
    <div className="space-y-0.5">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      {items.map(item => <NavItemLink key={item.to} item={item} onNavigate={onNavigate} />)}
    </div>
  )
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const allowed = usePermission(item.requires ?? 'ALL')
  if (!allowed) return null
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors
        ${isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'}`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  )
}

function BottomNavItem({ item }: { item: NavItem }) {
  const allowed = usePermission(item.requires ?? 'ALL')
  if (!allowed) return <div className="flex-1" />
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors
        ${isActive ? 'text-primary' : 'text-text-muted'}`
      }
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] leading-none">{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-bold text-white">C</div>
        <span className="font-semibold text-text-primary">CRM Platform</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <NavSection title="Main"     items={MAIN_NAV}     onNavigate={onNavigate} />
        <NavSection title="Support"  items={SUPPORT_NAV}  onNavigate={onNavigate} />
        <NavSection title="Insights" items={INSIGHTS_NAV} onNavigate={onNavigate} />
      </nav>
      <div className="border-t border-border p-3">
        <NavLink to="/settings" onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors
            ${isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'}`
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger — fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 rounded-lg bg-surface border border-border p-2 shadow-raised text-text-primary"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile slide-in drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-surface shadow-modal">
            <button onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-text-muted hover:bg-surface-3">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Mobile bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-surface">
        {BOTTOM_NAV.map(item => <BottomNavItem key={item.to} item={item} />)}
      </nav>
    </>
  )
}
