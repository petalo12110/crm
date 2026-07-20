import { prisma } from '../../infrastructure/database/prisma'
import { log }    from '../../config/logger'
import type { Prisma } from '@prisma/client'
import type { TimelineEntryType } from '@crm/shared'

export interface CreateTimelineEntryInput {
  companyId:     string
  customerId:    string
  entryType:     TimelineEntryType
  direction?:    'INBOUND' | 'OUTBOUND' | 'INTERNAL'
  subject?:      string
  body?:         string
  userId?:       string
  refEntityType?:string
  refEntityId?:  string
  metadata?:     Record<string, unknown>
  occurredAt?:   Date
}

export class TimelineService {
  async addEntry(input: CreateTimelineEntryInput): Promise<void> {
    try {
      await prisma.timelineEntry.create({
        data: {
          companyId:     input.companyId,
          customerId:    input.customerId,
          entryType:     input.entryType as never,
          direction:     (input.direction ?? 'INTERNAL') as never,
          subject:       input.subject,
          body:          input.body,
          userId:        input.userId,
          refEntityType: input.refEntityType,
          refEntityId:   input.refEntityId,
          metadata:      input.metadata as Prisma.InputJsonValue | undefined,
          occurredAt:    input.occurredAt ?? new Date(),
        },
      })
    } catch (err) {
      log.error('Failed to write timeline entry', { err: String(err) })
    }
  }

  async listForCustomer(
    customerId: string,
    companyId:  string,
    filters: { type?: string; limit?: number; cursor?: string } = {}
  ) {
    const limit = filters.limit ?? 25
    const take  = limit + 1
    const items = await prisma.timelineEntry.findMany({
      where: {
        customerId,
        companyId,
        ...(filters.type && { entryType: filters.type as never }),
      },
      orderBy: { occurredAt: 'desc' },
      take,
      ...(filters.cursor && {
        cursor: { id: Buffer.from(filters.cursor, 'base64url').toString() },
        skip:   1,
      }),
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    const hasMore = items.length > limit
    const data    = hasMore ? items.slice(0, limit) : items
    return {
      data,
      meta: {
        cursor:  hasMore ? Buffer.from(data[data.length - 1].id).toString('base64url') : null,
        hasMore,
        limit,
        total:   await prisma.timelineEntry.count({ where: { customerId, companyId } }),
      },
    }
  }
}

export const timelineService = new TimelineService()
