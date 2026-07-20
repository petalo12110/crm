import { prisma } from '../../infrastructure/database/prisma'
import { log }    from '../../config/logger'
import type { NotificationType } from '@crm/shared'

export interface CreateNotificationInput {
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

export class NotificationsService {
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          companyId:  input.companyId,
          userId:     input.userId,
          type:       input.type as never,
          title:      input.title,
          body:       input.body,
          entityType: input.entityType,
          entityId:   input.entityId,
          url:        input.url,
          priority:   input.priority ?? 1,
        },
      })
    } catch (err) {
      log.error('Failed to create notification', { err: String(err) })
    }
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    await Promise.allSettled(inputs.map(i => this.create(i)))
  }

  async listForUser(userId: string, companyId: string, limit = 25, cursor?: string) {
    const take  = limit + 1
    const items = await prisma.notification.findMany({
      where:   { userId, companyId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor && { cursor: { id: Buffer.from(cursor, 'base64url').toString() }, skip: 1 }),
    })
    const hasMore = items.length > limit
    const data    = hasMore ? items.slice(0, limit) : items
    return {
      data,
      meta: {
        cursor:  hasMore ? Buffer.from(data[data.length - 1].id).toString('base64url') : null,
        hasMore,
        limit,
      },
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } })
  }

  async markRead(id: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id, userId },
      data:  { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string, companyId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, companyId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    })
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({ where: { id, userId } })
  }
}

export const notificationsService = new NotificationsService()
