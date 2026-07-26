import { prisma }        from '../../infrastructure/database/prisma'
import { encrypt, decrypt } from '../../core/utils/index'
import { ValidationError } from '../../core/errors'
import {
  renderTemplate, sendEmailWithEmailConfig, verifyEmailConfig,
  type EmailConfig,
} from '../../infrastructure/email/EmailProvider'
import { log } from '../../config/logger'

const SETTINGS_ID = 'global'

export interface SmtpSettingsInput {
  emailProvider: 'smtp' | 'resend'
  host?:      string
  port?:      number
  secure:     boolean
  user?:      string
  /** Omit to keep the currently-saved password unchanged. */
  pass?:      string
  /** Omit to keep the currently-saved Resend key unchanged. */
  resendApiKey?: string
  emailFrom:  string
}

/** Safe shape returned to the frontend — secrets themselves are never sent back. */
export interface SmtpSettingsView {
  emailProvider: string
  host:          string | null
  port:          number | null
  secure:        boolean
  user:          string | null
  emailFrom:     string | null
  hasPassword:   boolean
  hasResendKey:  boolean
  updatedAt:     Date | null
  configured:    boolean
}

export class AdminService {
  async getSmtpSettings(): Promise<SmtpSettingsView> {
    const row = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })
    if (!row) {
      return {
        emailProvider: 'smtp', host: null, port: null, secure: false, user: null, emailFrom: null,
        hasPassword: false, hasResendKey: false, updatedAt: null, configured: false,
      }
    }
    const configured = row.emailProvider === 'resend' ? !!row.resendApiKeyEncrypted : !!row.smtpHost
    return {
      emailProvider: row.emailProvider,
      host:          row.smtpHost,
      port:          row.smtpPort,
      secure:        row.smtpSecure,
      user:          row.smtpUser,
      emailFrom:     row.emailFrom,
      hasPassword:   !!row.smtpPassEncrypted,
      hasResendKey:  !!row.resendApiKeyEncrypted,
      updatedAt:     row.updatedAt,
      configured,
    }
  }

  /**
   * Returns the decrypted config ready to hand to the email sender.
   * Internal use only (worker / test-send) — never expose plaintext
   * secrets over the API.
   */
  async getDecryptedEmailConfig(): Promise<EmailConfig | null> {
    const row = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })
    if (!row) return null

    if (row.emailProvider === 'resend') {
      if (!row.resendApiKeyEncrypted) return null
      return {
        provider: 'resend',
        resend: {
          apiKey:    decrypt(row.resendApiKeyEncrypted),
          emailFrom: row.emailFrom ?? 'noreply@crm.local',
        },
      }
    }

    if (!row.smtpHost) return null
    return {
      provider: 'smtp',
      smtp: {
        host:      row.smtpHost,
        port:      row.smtpPort ?? 587,
        secure:    row.smtpSecure,
        user:      row.smtpUser ?? '',
        pass:      row.smtpPassEncrypted ? decrypt(row.smtpPassEncrypted) : '',
        emailFrom: row.emailFrom ?? 'noreply@crm.local',
      },
    }
  }

  async updateSmtpSettings(dto: SmtpSettingsInput, updatedBy: string): Promise<SmtpSettingsView> {
    const existing = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })

    if (dto.emailProvider === 'smtp') {
      if (!dto.host?.trim())      throw new ValidationError('SMTP host is required')
      if (!dto.port || dto.port < 1 || dto.port > 65535) throw new ValidationError('SMTP port must be between 1 and 65535')
    } else {
      if (!dto.resendApiKey && !existing?.resendApiKeyEncrypted) {
        throw new ValidationError('Resend API key is required')
      }
    }
    if (!dto.emailFrom?.trim()) throw new ValidationError('"From" address is required')

    // Keep existing encrypted secrets if the admin didn't type a new one
    // (frontend never receives the real secret back, so a blank field
    // should mean "leave it alone", not "erase it").
    const smtpPassEncrypted = dto.pass
      ? encrypt(dto.pass)
      : existing?.smtpPassEncrypted ?? null
    const resendApiKeyEncrypted = dto.resendApiKey
      ? encrypt(dto.resendApiKey)
      : existing?.resendApiKeyEncrypted ?? null

    const data = {
      emailProvider: dto.emailProvider,
      smtpHost: dto.host ?? null, smtpPort: dto.port ?? null, smtpSecure: dto.secure,
      smtpUser: dto.user ?? null, smtpPassEncrypted, resendApiKeyEncrypted,
      emailFrom: dto.emailFrom, updatedBy,
    }

    const row = await prisma.systemSettings.upsert({
      where:  { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    })

    log.info('Email settings updated', { updatedBy, provider: dto.emailProvider, host: dto.host, port: dto.port })

    return {
      emailProvider: row.emailProvider,
      host: row.smtpHost, port: row.smtpPort, secure: row.smtpSecure,
      user: row.smtpUser, emailFrom: row.emailFrom,
      hasPassword: !!row.smtpPassEncrypted, hasResendKey: !!row.resendApiKeyEncrypted,
      updatedAt: row.updatedAt,
      configured: row.emailProvider === 'resend' ? !!row.resendApiKeyEncrypted : !!row.smtpHost,
    }
  }

  /**
   * Sends a real test email using either the just-submitted (unsaved) form
   * values or, if none given, the currently saved settings — so "Test" in
   * the UI reflects exactly what the admin is looking at, before or after
   * clicking Save.
   */
  async testSmtpSettings(recipient: string, override?: SmtpSettingsInput): Promise<{ success: boolean; error?: string }> {
    let cfg: EmailConfig | null

    if (override) {
      const existing = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })
      if (override.emailProvider === 'resend') {
        const apiKey = override.resendApiKey ?? (existing?.resendApiKeyEncrypted ? decrypt(existing.resendApiKeyEncrypted) : '')
        cfg = apiKey ? { provider: 'resend', resend: { apiKey, emailFrom: override.emailFrom } } : null
      } else {
        cfg = override.host ? {
          provider: 'smtp',
          smtp: {
            host: override.host,
            port: override.port ?? 587,
            secure: override.secure,
            user: override.user ?? '',
            // If testing without retyping the password, fall back to
            // whatever's already saved (same "blank = unchanged" rule as save).
            pass: override.pass ?? (existing?.smtpPassEncrypted ? decrypt(existing.smtpPassEncrypted) : ''),
            emailFrom: override.emailFrom,
          },
        } : null
      }
    } else {
      cfg = await this.getDecryptedEmailConfig()
    }

    if (!cfg) return { success: false, error: 'No email configuration to test — fill in the form or save settings first.' }

    try {
      const ok = await verifyEmailConfig(cfg)
      if (!ok) {
        const hint = cfg.provider === 'smtp'
          ? "Could not verify connection to the SMTP server. Check host, port, and credentials — note some hosts (like Render's free plan) block outbound SMTP ports entirely, in which case switch to the Resend (HTTP API) option above."
          : 'Could not authenticate with Resend. Check your API key.'
        return { success: false, error: hint }
      }

      const emailFrom = cfg.provider === 'resend' ? cfg.resend.emailFrom : cfg.smtp.emailFrom
      const hostLabel  = cfg.provider === 'resend' ? 'Resend API' : cfg.smtp.host

      await sendEmailWithEmailConfig(cfg, {
        to:      recipient,
        subject: 'TrustLoop — email test',
        html:    renderTemplate('smtp-test', { emailFrom, host: hostLabel }),
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error sending test email' }
    }
  }
}

export const adminService = new AdminService()
