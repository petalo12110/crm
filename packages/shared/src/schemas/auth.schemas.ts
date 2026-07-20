import { z } from 'zod'

export const LoginSchema = z.object({
  email:      z.string().email('Invalid email address'),
  password:   z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
})
export type LoginInput = z.infer<typeof LoginSchema>

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})
export type RefreshInput = z.infer<typeof RefreshSchema>

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>

export const ResetPasswordSchema = z.object({
  token:    z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/,  'Password must contain at least one uppercase letter')
    .regex(/[0-9]/,  'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
})
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/,  'Must contain uppercase')
    .regex(/[0-9]/,  'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
})
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  phone:     z.string().max(50).optional().nullable(),
  timezone:  z.string().max(100).optional(),
  language:  z.string().max(10).optional(),
})
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
