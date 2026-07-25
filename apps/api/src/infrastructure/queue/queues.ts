import { Queue }    from 'bullmq'
import { config }   from '../../config/env'
import type { NotificationType } from '@crm/shared'

// BullMQ accepts a connection URL string directly
const connection = { url: config.REDIS_URL }

const defaultJobOptions = {
  attempts:    3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 500 },
}

export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions,
})

export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions,
})

export const reportQueue = new Queue('reports', {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
})

export const cleanupQueue = new Queue('cleanup', {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
})

// ── Job payload types ──────────────────────────────────────

export interface EmailJobData {
  to:       string
  subject:  string
  template: string
  context:  Record<string, unknown>
  from?:    string
  /**
   * When set, the worker prefers this company's own SMTP settings
   * (Company.smtp*) over the global platform default (SystemSettings),
   * for company-branded outbound mail. Falls back to the global config,
   * then to env vars, if the company hasn't configured its own SMTP.
   */
  companyId?: string
}

export interface NotificationJobData {
  companyId:   string
  userId:      string
  type:        NotificationType
  title:       string
  body?:       string
  entityType?: string
  entityId?:   string
  url?:        string
  priority?:   number
}

export interface ReportJobData {
  reportType:  string
  format:      'pdf' | 'csv' | 'excel'
  filters:     Record<string, unknown>
  requestedBy: string
  companyId:   string
  jobId:       string
}
