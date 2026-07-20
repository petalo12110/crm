import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { api } from '@/lib/axios'

export interface CurrentUser {
  id:        string
  email:     string
  firstName: string
  lastName:  string
  role:      string
  /** null for a platform Super Admin — not scoped to any company. */
  companyId: string | null
  avatarUrl: string | null
  company?: {
    id: string; name: string; slug: string; timezone: string; currency: string
  }
}

interface AuthContextValue {
  user:         CurrentUser | null
  isLoading:    boolean
  isAuthenticated: boolean
  login:        (email: string, password: string, companyId: string) => Promise<void>
  adminLogin:   (email: string, password: string) => Promise<void>
  logout:       () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setIsLoading(false)
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.data)
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const login = useCallback(async (email: string, password: string, companyId: string) => {
    const { data } = await api.post(
      '/auth/login',
      { email, password },
      { headers: { 'X-Company-ID': companyId } }
    )
    localStorage.setItem('accessToken',  data.data.accessToken)
    localStorage.setItem('refreshToken', data.data.refreshToken)
    localStorage.setItem('companyId',    companyId)
    localStorage.setItem('authMode',     'company')
    setUser(data.data.user)
  }, [])

  // Deliberately a separate method (not login() with an optional companyId)
  // so the two audiences can never be mixed up at a call site — a Super
  // Admin session never has a companyId to store at all.
  const adminLogin = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/admin/login', { email, password })
    localStorage.setItem('accessToken',  data.data.accessToken)
    localStorage.setItem('refreshToken', data.data.refreshToken)
    localStorage.removeItem('companyId') // a super admin session has none
    localStorage.setItem('authMode', 'admin')
    setUser(data.data.user)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      await api.post('/auth/logout', { refreshToken })
    } catch {
      // ignore — clear local state regardless
    }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('companyId')
    localStorage.removeItem('authMode')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
