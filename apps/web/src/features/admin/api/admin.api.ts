import { api } from '@/lib/axios'

export const adminApi = {
  // ── Companies (Super Admin) ─────────────────────────────
  listCompanies: (params: Record<string, unknown> = {}) =>
    api.get('/companies', { params }).then(r => r.data),

  createCompany: (body: Record<string, unknown>) =>
    api.post('/companies', body).then(r => r.data.data),

  updateCompany: (id: string, body: Record<string, unknown>) =>
    api.patch(`/companies/${id}`, body).then(r => r.data.data),

  inviteMember: (companyId: string, body: Record<string, unknown>) =>
    api.post(`/companies/${companyId}/members`, body).then(r => r.data.data),

  // ── Platform SMTP settings ──────────────────────────────
  getSmtpSettings: () =>
    api.get('/admin/settings/smtp').then(r => r.data.data),

  updateSmtpSettings: (body: SmtpSettingsInput) =>
    api.put('/admin/settings/smtp', body).then(r => r.data.data),

  testSmtpSettings: (recipient: string, settings?: SmtpSettingsInput) =>
    api.post('/admin/settings/smtp/test', { recipient, settings })
      .then(r => r.data.data as { success: boolean; error?: string }),
}

export interface SmtpSettingsInput {
  host:      string
  port:      number
  secure:    boolean
  user?:     string
  pass?:     string
  emailFrom: string
}
