import { api } from '@/lib/axios'

export const authApi = {
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/me/password', { currentPassword, newPassword }),
  updateProfile:  (data: Record<string, unknown>) => api.patch('/auth/me', data),
}
