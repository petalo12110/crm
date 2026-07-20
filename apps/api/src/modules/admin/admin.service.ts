import { prisma }        from '../../infrastructure/database/prisma'
import { encrypt, decrypt } from '../../core/utils/index'
import { ValidationError } from '../../core/errors'
import { SmtpEmailProvider, renderTemplate, type SmtpConfig } from '../../infrastructure/email/EmailProvider'
import { log } from '../../config/logger'

const SETTINGS_ID = 'global'

export interface SmtpSettingsInput {
  host:      string
  port:      number
  secure:    boolean
  user?:     string
  /** Omit to keep the currently-saved password unchanged. */
  pass?:     string
  emailFrom: string
}

/** Safe shape returned to the frontend — the password itself is never sent back. */
export interface SmtpSettingsView {
  host:          string | null
  port:          number | null
  secure:        boolean
  user:          string | null
  emailFrom:     string | null
  hasPassword:   boolean
  updatedAt:     Date | null
  configured:    boolean
}

export class AdminService {
  async getSmtpSettings(): Promise<SmtpSettingsView> {
    const row = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })
    if (!row) {
      return {
        host: null, port: null, secure: false, user: null, emailFrom: null,
        hasPassword: false, updatedAt: null, configured: false,
      }
    }
    return {
      host:        row.smtpHost,
      port:        row.smtpPort,
      secure:      row.smtpSecure,
      user:        row.smtpUser,
      emailFrom:   row.emailFrom,
      hasPassword: !!row.smtpPassEncrypted,
      updatedAt:   row.updatedAt,
      configured:  !!row.smtpHost,
    }
  }

  /**
   * Returns the decrypted config ready to hand to nodemailer. Internal use
   * only (worker / test-send) — never expose the plaintext password over
   * the API.
   */
  async getDecryptedSmtpConfig(): Promise<SmtpConfig | null> {
    const row = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })
    if (!row?.smtpHost) return null
    return {
      host:      row.smtpHost,
      port:      row.smtpPort ?? 587,
      secure:    row.smtpSecure,
      user:      row.smtpUser ?? '',
      pass:      row.smtpPassEncrypted ? decrypt(row.smtpPassEncrypted) : '',
      emailFrom: row.emailFrom ?? 'noreply@crm.local',
    }
  }

  async updateSmtpSettings(dto: SmtpSettingsInput, updatedBy: string): Promise<SmtpSettingsView> {
    if (!dto.host?.trim())      throw new ValidationError('SMTP host is required')
    if (!dto.port || dto.port < 1 || dto.port > 65535) throw new ValidationError('SMTP port must be between 1 and 65535')
    if (!dto.emailFrom?.trim()) throw new ValidationError('"From" address is required')

    const existing = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })

    // Keep the existing encrypted password if the admin didn't type a new one
    // (frontend never receives the real password back, so a blank field
    // should mean "leave it alone", not "erase it").
    const smtpPassEncrypted = dto.pass
      ? encrypt(dto.pass)
      : existing?.smtpPassEncrypted ?? null

    const row = await prisma.systemSettings.upsert({
      where:  { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        smtpHost: dto.host, smtpPort: dto.port, smtpSecure: dto.secure,
        smtpUser: dto.user ?? null, smtpPassEncrypted,
        emailFrom: dto.emailFrom, updatedBy,
      },
      update: {
        smtpHost: dto.host, smtpPort: dto.port, smtpSecure: dto.secure,
        smtpUser: dto.user ?? null, smtpPassEncrypted,
        emailFrom: dto.emailFrom, updatedBy,
      },
    })

    log.info('SMTP settings updated', { updatedBy, host: dto.host, port: dto.port })

    return {
      host: row.smtpHost, port: row.smtpPort, secure: row.smtpSecure,
      user: row.smtpUser, emailFrom: row.emailFrom,
      hasPassword: !!row.smtpPassEncrypted, updatedAt: row.updatedAt,
      configured: !!row.smtpHost,
    }
  }

  /**
   * Sends a real test email using either the just-submitted (unsaved) form
   * values or, if none given, the currently saved settings — so "Test" in
   * the UI reflects exactly what the admin is looking at, before or after
   * clicking Save.
   */
  async testSmtpSettings(recipient: string, override?: SmtpSettingsInput): Promise<{ success: boolean; error?: string }> {
    let cfg: SmtpConfig | null

    if (override) {
      const existing = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } })
      cfg = {
        host: override.host,
        port: override.port,
        secure: override.secure,
        user: override.user ?? '',
        // If they're testing without retyping the password, fall back to
        // whatever's already saved (same "blank = unchanged" rule as save).
        pass: override.pass ?? (existing?.smtpPassEncrypted ? decrypt(existing.smtpPassEncrypted) : ''),
        emailFrom: override.emailFrom,
      }
    } else {
      cfg = await this.getDecryptedSmtpConfig()
    }

    if (!cfg) return { success: false, error: 'No SMTP configuration to test — fill in the form or save settings first.' }

    const provider = new SmtpEmailProvider(cfg)
    try {
      const ok = await provider.verify()
      if (!ok) return { success: false, error: 'Could not verify connection to the SMTP server. Check host, port, and credentials.' }

      await provider.send({
        to:      recipient,
        subject: 'CRM Platform — SMTP test',
        html:    renderTemplate('smtp-test', { emailFrom: cfg.emailFrom, host: cfg.host }),
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown SMTP error' }
    }
  }
}

export const adminService = new AdminService()
