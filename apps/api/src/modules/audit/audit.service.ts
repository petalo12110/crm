import { prisma } from '../../infrastructure/database/prisma'
import { log }    from '../../config/logger'
import type { Prisma } from '@prisma/client'
import type { AuditAction } from '@crm/shared'

export interface AuditLogEntry {
  companyId?:  string | null
  userId?:     string
  action:      AuditAction
  entityType?: string
  entityId?:   string
  ipAddress?:  string
  userAgent?:  string
  oldValues?:  Record<string, unknown>
  newValues?:  Record<string, unknown>
  metadata?:   Record<string, unknown>
}

export class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          companyId:  entry.companyId,
          userId:     entry.userId,
          action:     entry.action as never,
          entityType: entry.entityType,
          entityId:   entry.entityId,
          ipAddress:  entry.ipAddress,
          userAgent:  entry.userAgent,
          // Prisma's JSON columns want its own InputJsonValue type, which
          // a plain Record<string, unknown> doesn't structurally satisfy
          // even though the actual data is always plain JSON-serializable
          // — a cast is the standard, safe way to bridge this (we're not
          // widening what's accepted, just telling TS what Prisma already
          // accepts at runtime for any JSON-serializable object).
          oldValues:  (entry.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
          newValues:  (entry.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
          metadata:   (entry.metadata  ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      })
    } catch (err) {
      log.error('Failed to write audit log', { err: String(err) })
    }
  }
}

export const auditService = new AuditService()
