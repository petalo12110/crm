import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Mail, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { usePortalAuth } from '@/context/PortalAuthContext'

interface LoginForm {
  email: string
}

export function PortalLoginPage() {
  const { companySlug } = useParams<{ companySlug: string }>()
  const { requestLoginLink, isAuthenticated } = usePortalAuth()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  // Same reasoning as GuestRoute for the tenant/admin logins — don't show
  // a login form (and risk it silently swapping the active session) to
  // someone who's already signed in.
  if (isAuthenticated) {
    return <Navigate to={`/portal/${companySlug}/tickets`} replace />
  }

  const onSubmit = async (values: LoginForm) => {
    setError(null)
    setLoading(true)
    try {
      await requestLoginLink(companySlug!, values.email)
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h1 className="text-lg font-semibold text-text-primary">Check your email</h1>
        <p className="text-sm text-text-secondary">
          If that email is on file, we've sent a login link. It expires in 30 minutes.
        </p>
        <button onClick={() => setSent(false)} className="text-sm text-primary hover:underline">
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center">
        <Mail className="mx-auto mb-2 h-8 w-8 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Sign in to your account</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Enter your email and we'll send you a secure login link — no password needed.
        </p>
      </div>

      {error && <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      <Input
        label="Email address"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email', { required: 'Email is required' })}
      />

      <Button type="submit" className="w-full" loading={loading}>
        Send login link
      </Button>
    </form>
  )
}
