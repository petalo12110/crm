import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Check, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authApi } from '../api/auth.api'

interface ResetForm {
  password: string
  confirm:  string
}

const REQUIREMENTS = [
  { label: 'At least 8 characters',      test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter',        test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One number',                  test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character',       test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

function RequirementsChecklist({ password }: { password: string }) {
  return (
    <ul className="space-y-1 rounded-md bg-surface-2 p-3">
      {REQUIREMENTS.map(req => {
        const met = req.test(password)
        return (
          <li key={req.label} className={`flex items-center gap-1.5 text-xs ${met ? 'text-success' : 'text-text-secondary'}`}>
            {met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-text-muted" />}
            {req.label}
          </li>
        )
      })}
    </ul>
  )
}

// Parses the API's structured validation `details` array (if present) into
// a short, readable list instead of showing a single opaque message — and
// still falls back gracefully for errors that aren't validation-shaped.
function parseApiError(err: unknown): { message: string; details: string[] } {
  const response = (err as { response?: { data?: { error?: {
    message?: string; details?: Array<{ field?: string; message: string }>
  } } } })?.response?.data?.error

  if (response?.details?.length) {
    return {
      message: 'Please fix the following:',
      details: response.details.map(d => d.message),
    }
  }
  return { message: response?.message ?? 'Reset failed. The link may have expired.', details: [] }
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token     = params.get('token') ?? ''
  const navigate  = useNavigate()
  const [error, setError]     = useState<{ message: string; details: string[] } | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetForm>()
  const password = watch('password') ?? ''
  const allRequirementsMet = REQUIREMENTS.every(r => r.test(password))

  const onSubmit = async (values: ResetForm) => {
    if (values.password !== values.confirm) {
      setError({ message: 'Passwords do not match', details: [] })
      return
    }
    setError(null)
    setLoading(true)
    try {
      await authApi.resetPassword(token, values.password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: unknown) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Password updated</h1>
        <p className="text-sm text-text-secondary">Redirecting you to login…</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm text-danger">No reset token found. Please use the link from your email.</p>
        <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Set a new password</h1>

      {error && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-medium">{error.message}</p>
          {error.details.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {error.details.map(d => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      <div>
        <Input
          label="New password"
          type="password"
          error={errors.password?.message}
          {...register('password', { required: 'Password is required' })}
        />
        {password.length > 0 && (
          <div className="mt-2">
            <RequirementsChecklist password={password} />
          </div>
        )}
      </div>

      <Input
        label="Confirm password"
        type="password"
        error={errors.confirm?.message}
        {...register('confirm', { required: 'Please confirm your password' })}
      />

      <Button type="submit" className="w-full" loading={loading} disabled={password.length > 0 && !allRequirementsMet}>
        Update password
      </Button>
    </form>
  )
}
