import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface AdminLoginForm {
  email:    string
  password: string
}

export function AdminLoginPage() {
  const { adminLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<AdminLoginForm>()

  const onSubmit = async (values: AdminLoginForm) => {
    setServerError(null)
    setLoading(true)
    try {
      await adminLogin(values.email, values.password)
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/admin'
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
        <h1 className="text-lg font-semibold text-text-primary">Platform sign in</h1>
        <p className="text-sm text-text-secondary">Company user? <a href="/login" className="text-primary hover:underline">Sign in here instead</a></p>
      </div>

      {serverError && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</div>
      )}

      <Input
        label="Email"
        type="email"
        placeholder="you@yourplatform.com"
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

      <Button type="submit" className="w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  )
}
