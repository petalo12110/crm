import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { portalApi } from '@/lib/portalAxios'

export interface PortalCustomer {
  id:        string
  firstName: string | null
  lastName:  string | null
  email:     string | null
  companyId: string
}

export interface PortalCompany {
  id:   string
  name: string
  slug: string
}

interface PortalAuthContextValue {
  customer: PortalCustomer | null
  company:  PortalCompany | null
  isLoading: boolean
  isAuthenticated: boolean
  requestLoginLink: (companySlug: string, email: string) => Promise<void>
  verifyLoginLink:  (companySlug: string, token: string) => Promise<void>
  logout: () => void
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null)

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null)
  const [company, setCompany]   = useState<PortalCompany | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('portalAccessToken')
    const storedCustomer = localStorage.getItem('portalCustomer')
    const storedCompany  = localStorage.getItem('portalCompany')
    if (token && storedCustomer && storedCompany) {
      try {
        setCustomer(JSON.parse(storedCustomer))
        setCompany(JSON.parse(storedCompany))
      } catch {
        // Corrupt local storage — treat as logged out rather than crash.
      }
    }
    setIsLoading(false)
  }, [])

  const requestLoginLink = useCallback(async (companySlug: string, email: string) => {
    await portalApi.post(`/${companySlug}/auth/request-link`, { email })
  }, [])

  const verifyLoginLink = useCallback(async (companySlug: string, token: string) => {
    const { data } = await portalApi.post(`/${companySlug}/auth/verify`, { token })
    localStorage.setItem('portalAccessToken', data.data.accessToken)
    localStorage.setItem('portalCustomer',    JSON.stringify(data.data.customer))
    localStorage.setItem('portalCompany',     JSON.stringify(data.data.company))
    localStorage.setItem('portalCompanySlug', companySlug)
    setCustomer(data.data.customer)
    setCompany(data.data.company)
  }, [])

  const logout = useCallback(() => {
    const slug = company?.slug
    localStorage.removeItem('portalAccessToken')
    localStorage.removeItem('portalCustomer')
    localStorage.removeItem('portalCompany')
    localStorage.removeItem('portalCompanySlug')
    setCustomer(null)
    setCompany(null)
    if (slug) window.location.href = `/portal/${slug}/login`
  }, [company])

  return (
    <PortalAuthContext.Provider value={{
      customer, company, isLoading, isAuthenticated: !!customer,
      requestLoginLink, verifyLoginLink, logout,
    }}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext)
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider')
  return ctx
}
