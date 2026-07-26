import nodemailer from 'nodemailer'
import Handlebars from 'handlebars'
import * as fs    from 'fs'
import * as path  from 'path'
import { config } from '../../config/env'
import { log }    from '../../config/logger'

export interface EmailProvider {
  send(opts: SendEmailOpts): Promise<void>
}

export interface SendEmailOpts {
  to:       string | string[]
  subject:  string
  html:     string
  text?:    string
  from?:    string
  replyTo?: string
}

export interface SmtpConfig {
  host:       string
  port:       number
  secure:     boolean
  user:       string
  pass:       string
  emailFrom:  string
}

const templateCache: Record<string, HandlebarsTemplateDelegate> = {}

export function renderTemplate(templateName: string, context: Record<string, unknown>): string {
  if (!templateCache[templateName]) {
    const filePath = path.join(__dirname, 'templates', `${templateName}.hbs`)
    if (!fs.existsSync(filePath)) {
      return `<p>${JSON.stringify(context)}</p>`
    }
    const src = fs.readFileSync(filePath, 'utf8')
    templateCache[templateName] = Handlebars.compile(src)
  }
  return templateCache[templateName](context)
}

function defaultConfig(): SmtpConfig {
  // Falls back to Mailpit-friendly local dev defaults when nothing else is
  // configured (no auth, plaintext, port 1025) — this is what makes the
  // provider work out of the box before anyone touches the Super Admin UI.
  return {
    host:      config.SMTP_HOST ?? 'localhost',
    port:      config.SMTP_PORT ?? 587,
    secure:    config.SMTP_PORT === 465,
    user:      config.SMTP_USER ?? '',
    pass:      config.SMTP_PASS ?? '',
    emailFrom: config.EMAIL_FROM,
  }
}

/** Cheap way to detect "did the config actually change" without a deep-equal lib. */
function signatureOf(cfg: SmtpConfig): string {
  return `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass}:${cfg.emailFrom}`
}

function buildTransporter(cfg: SmtpConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    // Only force a TLS upgrade on the well-known submission port (587),
    // which is what real providers (Gmail, SendGrid, Mailgun, Outlook)
    // use and do support STARTTLS on. Local dev tools like Mailpit
    // commonly run on other ports (1025) specifically without any TLS
    // support — forcing requireTLS there breaks them outright, so this
    // only applies to 587 rather than "every non-secure port."
    requireTLS: !cfg.secure && cfg.port === 587,
    auth:   cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  })
}

// ── Concurrency-safe, config-scoped sending ──────────────────
//
// The email worker processes jobs with concurrency:5, and different jobs
// can carry different SMTP configs (per-company override vs. the global
// platform default). A single shared "configure() then send()" instance
// is a race condition under concurrency — job A could reconfigure the
// shared transporter for company B's credentials in between job A's
// configure() and send() calls. This cache instead resolves an
// independent transporter per distinct config, so concurrent sends with
// different configs never interfere with each other.
//
// Bounded so it can't grow forever if many companies rotate SMTP
// credentials over the app's lifetime — evicts the oldest entry (and
// closes its socket pool) once the cap is hit.
const MAX_CACHED_TRANSPORTERS = 50
const transporterCache = new Map<string, nodemailer.Transporter>()

function getCachedTransporter(cfg: SmtpConfig): nodemailer.Transporter {
  const sig = signatureOf(cfg)
  const existing = transporterCache.get(sig)
  if (existing) return existing

  const transporter = buildTransporter(cfg)
  if (transporterCache.size >= MAX_CACHED_TRANSPORTERS) {
    const oldestKey = transporterCache.keys().next().value
    if (oldestKey !== undefined) {
      transporterCache.get(oldestKey)?.close()
      transporterCache.delete(oldestKey)
    }
  }
  transporterCache.set(sig, transporter)
  return transporter
}

/** Sends one email using exactly the config passed in — no shared mutable state. */
export async function sendEmailWithConfig(cfg: SmtpConfig, opts: SendEmailOpts): Promise<void> {
  try {
    const transporter = getCachedTransporter(cfg)
    await transporter.sendMail({
      from:    opts.from ?? cfg.emailFrom,
      to:      Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text,
      replyTo: opts.replyTo,
    })
    log.info('Email sent', { to: String(opts.to), subject: opts.subject, host: cfg.host })
  } catch (err) {
    log.error('Failed to send email', { err: String(err), to: String(opts.to), host: cfg.host })
    throw err
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter
  private emailFrom:   string
  private signature:   string

  constructor(smtpConfig?: SmtpConfig) {
    const cfg = smtpConfig ?? defaultConfig()
    this.transporter = buildTransporter(cfg)
    this.emailFrom    = cfg.emailFrom
    this.signature     = signatureOf(cfg)
  }

  /** Rebuilds the underlying transporter only if the config actually changed. */
  configure(cfg: SmtpConfig): void {
    const sig = signatureOf(cfg)
    if (sig === this.signature) return
    this.transporter = buildTransporter(cfg)
    this.emailFrom    = cfg.emailFrom
    this.signature     = sig
    log.info('SMTP transporter reconfigured', { host: cfg.host, port: cfg.port, secure: cfg.secure })
  }

  async send(opts: SendEmailOpts): Promise<void> {
    try {
      await this.transporter.sendMail({
        from:    opts.from ?? this.emailFrom,
        to:      Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
        subject: opts.subject,
        html:    opts.html,
        text:    opts.text,
        replyTo: opts.replyTo,
      })
      log.info('Email sent', { to: String(opts.to), subject: opts.subject })
    } catch (err) {
      log.error('Failed to send email', { err: String(err), to: String(opts.to) })
      throw err
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch {
      return false
    }
  }
}

export const defaultEmailProvider = new SmtpEmailProvider()

// ── Resend (HTTPS API — no SMTP ports involved) ───────────────
//
// Render's free web-service plan blocks outbound traffic on SMTP ports
// 25/465/587 entirely (network-level, not something app code can work
// around). Resend's API is a plain HTTPS POST on port 443, so it isn't
// affected — this is the recommended path for anyone on a free Render
// plan who needs outbound email to actually work.

export interface ResendConfig {
  apiKey:    string
  emailFrom: string
}

const RESEND_API_URL = 'https://api.resend.com'

export async function sendEmailWithResend(cfg: ResendConfig, opts: SendEmailOpts): Promise<void> {
  const res = await fetch(`${RESEND_API_URL}/emails`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     opts.from ?? cfg.emailFrom,
      to:       Array.isArray(opts.to) ? opts.to : [opts.to],
      subject:  opts.subject,
      html:     opts.html,
      text:     opts.text,
      reply_to: opts.replyTo,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    log.error('Failed to send email via Resend', { status: res.status, body, to: String(opts.to) })
    throw new Error(`Resend API error (${res.status}): ${body || res.statusText}`)
  }
  log.info('Email sent via Resend', { to: String(opts.to), subject: opts.subject })
}

/** Lightweight key check — confirms the API key authenticates, without sending anything. */
export async function verifyResendConfig(cfg: ResendConfig): Promise<boolean> {
  try {
    const res = await fetch(`${RESEND_API_URL}/domains`, {
      headers: { 'Authorization': `Bearer ${cfg.apiKey}` },
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Provider-agnostic dispatch ─────────────────────────────────
//
// A single shape callers (the email worker, settings "test" endpoints)
// can resolve once and pass around, without needing their own
// if/else branching on which provider is active.

export type EmailConfig =
  | { provider: 'smtp';   smtp:   SmtpConfig }
  | { provider: 'resend'; resend: ResendConfig }

export async function sendEmailWithEmailConfig(cfg: EmailConfig, opts: SendEmailOpts): Promise<void> {
  if (cfg.provider === 'resend') return sendEmailWithResend(cfg.resend, opts)
  return sendEmailWithConfig(cfg.smtp, opts)
}

export async function verifyEmailConfig(cfg: EmailConfig): Promise<boolean> {
  if (cfg.provider === 'resend') return verifyResendConfig(cfg.resend)
  try {
    await getCachedTransporter(cfg.smtp).verify()
    return true
  } catch {
    return false
  }
}
