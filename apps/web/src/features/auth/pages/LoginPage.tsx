import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface LoginForm {
  companyId: string
  email:     string
  password:  string
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { companyId: localStorage.getItem('companyId') ?? '' },
  })

  const onSubmit = async (values: LoginForm) => {
    setServerError(null)
    setLoading(true)
    try {
      await login(values.email, values.password, values.companyId)
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Login failed. Please try again.'
      setServerError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Welcome back</h1>
        <p className="text-sm text-text-secondary">Sign in to your CRM workspace</p>
      </div>

      {serverError && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
      )}

      <Input
        label="Company ID"
        placeholder="Your company UUID"
        error={errors.companyId?.message}
        {...register('companyId', { required: 'Company ID is required' })}
      />

      <Input
        label="Email"
        type="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email', { required: 'Email is required' })}
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password', { required: 'Password is required' })}
      />

      <div className="flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  )
}
