import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authApi } from '../api/auth.api'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>()

  const onSubmit = async (values: { email: string }) => {
    setLoading(true)
    try {
      await authApi.forgotPassword(values.email)
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Check your email</h1>
        <p className="text-sm text-text-secondary">
          If that email exists in our system, a reset link has been sent.
        </p>
        <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Reset your password</h1>
        <p className="text-sm text-text-secondary">Enter your email and we'll send a reset link.</p>
      </div>

      <Input
        label="Email"
        type="email"
        error={errors.email?.message}
        {...register('email', { required: 'Email is required' })}
      />

      <Button type="submit" className="w-full" loading={loading}>
        Send reset link
      </Button>

      <Link to="/login" className="block text-center text-sm text-primary hover:underline">
        Back to login
      </Link>
    </form>
  )
}
