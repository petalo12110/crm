import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Moon, Sun, LogOut, ChevronDown } from 'lucide-react'
import { useAuth }   from '@/context/AuthContext'
import { useTheme }  from '@/context/ThemeContext'
import { Avatar }    from '@/components/ui/Badge'
import { useNotificationsCount } from '@/features/notifications/hooks/useNotifications'
import { NotificationPanel }     from '@/features/notifications/components/NotificationPanel'
import { GlobalSearch }          from '@/features/search/components/GlobalSearch'

export function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [menuOpen,   setMenuOpen]   = useState(false)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: unreadCount } = useNotificationsCount()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Topbar — left-pad on mobile to clear the hamburger button */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 pl-16 md:h-16 md:pl-5">

        {/* Search bar — hidden on smallest screens, shown md+ */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex w-64 items-center gap-2 rounded-md border border-border-strong
            bg-surface-2 px-3 py-1.5 text-sm text-text-muted hover:border-primary/40"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">Search everything...</span>
          <span className="md:hidden">Search...</span>
          <kbd className="ml-auto hidden rounded border border-border-strong bg-surface px-1.5 py-0.5 text-xs md:inline">⌘K</kbd>
        </button>

        {/* Mobile search icon */}
        <button
          onClick={() => setSearchOpen(true)}
          className="sm:hidden rounded-md p-2 text-text-secondary hover:bg-surface-3"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1">
          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative rounded-md p-2 text-text-secondary hover:bg-surface-3"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {!!unreadCount && unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center
                rounded-full bg-danger text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-text-secondary hover:bg-surface-3"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          {/* User menu */}
          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-surface-3"
            >
              <Avatar firstName={user?.firstName} lastName={user?.lastName} src={user?.avatarUrl} size="sm" />
              <span className="hidden text-sm font-medium text-text-primary sm:inline">
                {user?.firstName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border
                bg-surface py-1 shadow-modal z-50">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-sm font-medium text-text-primary">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-text-secondary">{user?.email}</p>
                  <p className="mt-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary inline-block">
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={async () => { setMenuOpen(false); await logout(); navigate('/login') }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm
                    text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  )
}
