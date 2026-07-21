import { Worker, Job } from 'bullmq'
import { config }      from '../../config/env'
import { log }         from '../../config/logger'
import { prisma }      from '../database/prisma'
import { decrypt }     from '../../core/utils/index'
import { defaultEmailProvider, renderTemplate, type SmtpConfig } from '../email/EmailProvider'
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

  // ── SMTP hot-reload ──────────────────────────────────────────
  //
  // When running as a separate process, the worker doesn't know when a
  // Super Admin saves new SMTP settings via the API. Rather than
  // requiring a restart, every email job re-checks the saved settings
  // first and reconfigures the shared SmtpEmailProvider in place if
  // they've changed (SmtpEmailProvider.configure is a no-op if the
  // config signature is unchanged, so this is cheap). Harmless — if
  // anything, slightly redundant — when running combined in the same
  // process as the API, since that process already has the latest
  // config in memory from whoever last saved it.
  async function syncSmtpConfigFromDb(): Promise<void> {
    try {
      const row = await prisma.systemSettings.findUnique({ where: { id: 'global' } })
      if (!row?.smtpHost) return

      const cfg: SmtpConfig = {
        host:      row.smtpHost,
        port:      row.smtpPort ?? 587,
        secure:    row.smtpSecure,
        user:      row.smtpUser ?? '',
        pass:      row.smtpPassEncrypted ? decrypt(row.smtpPassEncrypted) : '',
        emailFrom: row.emailFrom ?? config.EMAIL_FROM,
      }
      defaultEmailProvider.configure(cfg)
    } catch (err) {
      log.error('Failed to sync SMTP config from database', { err: String(err) })
    }
  }

  const emailWorker = new Worker<EmailJobData>(
    'email',
    async (job: Job<EmailJobData>) => {
      await syncSmtpConfigFromDb()
      const html = renderTemplate(job.data.template, job.data.context)
      await defaultEmailProvider.send({
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
