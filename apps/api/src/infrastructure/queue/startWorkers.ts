import { Worker, Job } from 'bullmq'
import { config }      from '../../config/env'
import { log }         from '../../config/logger'
import { prisma }      from '../database/prisma'
import { decrypt }     from '../../core/utils/index'
import { sendEmailWithConfig, renderTemplate, type SmtpConfig } from '../email/EmailProvider'
import { notificationsService } from '../../modules/notifications/notifications.service'
import type { EmailJobData, NotificationJobData } from './queues'

/**
 * Starts the email/notification job processors and returns a close()
 * function. Deliberately has no process-level signal handling or
 * process.exit calls of its own — the caller (either the standalone
 * worker entrypoint, or server.ts when running combined) owns that,
 * since combined-mode shutdown needs to also close the HTTP server and
 * DB/Redis connections in the same sequence.
 *
 * Split out so this can run either as Render's dedicated "Background
 * Worker" service type (see workers/index.ts) or embedded directly in
 * the API process (see server.ts) — the latter exists because Render's
 * free plan doesn't include the Background Worker service type at all,
 * so a from-scratch free-tier deploy has no way to run a second service
 * for this. One Node process doing both isn't as clean as two focused
 * ones, but it's what actually works within that constraint. If you
 * later move to a paid plan, switching back to the separate `crm-worker`
 * service in render.yaml and removing the startWorkers() call from
 * server.ts is a clean split — nothing here is entangled with the HTTP
 * server itself.
 */
export function startWorkers() {
  const connection = { url: config.REDIS_URL }

  // ── SMTP config resolution ────────────────────────────────────
  //
  // Priority: the sending company's own SMTP settings (Company.smtp*,
  // configured via Settings > Email by a company owner) > the global
  // platform default (SystemSettings, configured by a Super Admin) >
  // env vars / Mailpit-friendly localhost default.
  //
  // Resolved fresh per job (not cached on a shared mutable instance) so
  // concurrent jobs for different companies can never race with each
  // other over which SMTP config is "currently active" — see
  // sendEmailWithConfig in EmailProvider.ts for the concurrency-safe
  // send path this feeds into.
  function envFallbackConfig(): SmtpConfig {
    return {
      host:      config.SMTP_HOST ?? 'localhost',
      port:      config.SMTP_PORT ?? 587,
      secure:    config.SMTP_PORT === 465,
      user:      config.SMTP_USER ?? '',
      pass:      config.SMTP_PASS ?? '',
      emailFrom: config.EMAIL_FROM,
    }
  }

  async function resolveSmtpConfig(companyId?: string): Promise<SmtpConfig> {
    try {
      if (companyId) {
        const company = await prisma.company.findUnique({
          where:  { id: companyId },
          select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPassEncrypted: true, smtpFrom: true },
        })
        if (company?.smtpHost) {
          return {
            host:      company.smtpHost,
            port:      company.smtpPort ?? 587,
            secure:    company.smtpPort === 465,
            user:      company.smtpUser ?? '',
            pass:      company.smtpPassEncrypted ? decrypt(company.smtpPassEncrypted) : '',
            emailFrom: company.smtpFrom ?? config.EMAIL_FROM,
          }
        }
      }

      const globalRow = await prisma.systemSettings.findUnique({ where: { id: 'global' } })
      if (globalRow?.smtpHost) {
        return {
          host:      globalRow.smtpHost,
          port:      globalRow.smtpPort ?? 587,
          secure:    globalRow.smtpSecure,
          user:      globalRow.smtpUser ?? '',
          pass:      globalRow.smtpPassEncrypted ? decrypt(globalRow.smtpPassEncrypted) : '',
          emailFrom: globalRow.emailFrom ?? config.EMAIL_FROM,
        }
      }
    } catch (err) {
      log.error('Failed to resolve SMTP config from database, falling back to env vars', { err: String(err) })
    }
    return envFallbackConfig()
  }

  const emailWorker = new Worker<EmailJobData>(
    'email',
    async (job: Job<EmailJobData>) => {
      const cfg  = await resolveSmtpConfig(job.data.companyId)
      const html = renderTemplate(job.data.template, job.data.context)
      await sendEmailWithConfig(cfg, {
        to:      job.data.to,
        subject: job.data.subject,
        html,
        from:    job.data.from,
      })
    },
    { connection, concurrency: 5 }
  )
  emailWorker.on('completed', job => log.info('Email job completed', { jobId: job.id, to: job.data.to }))
  emailWorker.on('failed', (job, err) => log.error('Email job failed', { jobId: job?.id, to: job?.data.to, err: String(err) }))

  const notificationWorker = new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      await notificationsService.create(job.data)
    },
    { connection, concurrency: 10 }
  )
  notificationWorker.on('failed', (job, err) =>
    log.error('Notification job failed', { jobId: job?.id, err: String(err) })
  )

  log.warn('reports/cleanup queues have no worker yet — jobs will queue but not run')
  log.info('Job workers started', {
    queues: ['email', 'notifications'],
    redis:  config.REDIS_URL.replace(/\/\/.*@/, '//***@'),
  })

  return {
    close: async () => {
      await Promise.allSettled([emailWorker.close(), notificationWorker.close()])
    },
  }
}
