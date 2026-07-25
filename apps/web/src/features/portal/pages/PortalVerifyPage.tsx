import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { LoadingState } from '@/components/ui/States'
import { usePortalAuth } from '@/context/PortalAuthContext'

export function PortalVerifyPage() {
  const { companySlug } = useParams<{ companySlug: string }>()
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { verifyLoginLink } = usePortalAuth()
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return // StrictMode/re-render guard — a token is single-use
    attempted.current = true

    if (!token || !companySlug) {
      setError('This login link is missing required information.')
      return
    }

    verifyLoginLink(companySlug, token)
      .then(() => navigate(`/portal/${companySlug}/tickets`, { replace: true }))
      .catch(() => setError('This login link is invalid or has expired. Please request a new one.'))
  }, [token, companySlug, verifyLoginLink, navigate])

  if (error) {
    return (
      <div className="space-y-3 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-danger" />
        <p className="text-sm text-danger">{error}</p>
        <a href={`/portal/${companySlug}/login`} className="text-sm font-medium text-primary hover:underline">
          Request a new link
        </a>
      </div>
    )
  }

  return <LoadingState />
}
