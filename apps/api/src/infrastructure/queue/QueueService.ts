import {
  emailQueue, notificationQueue, reportQueue,
  type EmailJobData, type NotificationJobData, type ReportJobData,
} from './queues'
import { log } from '../../config/logger'

export class QueueService {
  async sendEmail(data: EmailJobData, opts?: { delay?: number }): Promise<void> {
    try {
      await emailQueue.add('send', data, { delay: opts?.delay })
    } catch (err) {
      log.error('Failed to enqueue email job', { err: String(err) })
    }
  }

  async sendNotification(data: NotificationJobData): Promise<void> {
    try {
      await notificationQueue.add('deliver', data)
    } catch (err) {
      log.error('Failed to enqueue notification job', { err: String(err) })
    }
  }

  async generateReport(data: ReportJobData): Promise<void> {
    try {
      await reportQueue.add('generate', data)
    } catch (err) {
      log.error('Failed to enqueue report job', { err: String(err) })
    }
  }
}

export const queueService = new QueueService()
