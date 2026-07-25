import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../delivery/middleware/authenticate'
import { authorize }    from '../../delivery/middleware/authorize'
import { prisma }       from '../../infrastructure/database/prisma'
import { z }            from 'zod'

const router: Router = Router()

const AuditQuerySchema = z.object({
  userId:     z.string().uuid().optional(),
  action:     z.string().optional(),
  entityType: z.string().optional(),
  entityId:   z.string().uuid().optional(),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  limit:      z.coerce.number().min(1).max(100).default(50),
  cursor:     z.string().optional(),
})

router.get(
  '/',
  authenticate,
  authorize(['COMPANY_OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = AuditQuerySchema.parse(req.query)

      const where: Record<string, unknown> = {
        companyId: req.user.companyId,
        ...(q.userId     && { userId:     q.userId }),
        ...(q.action     && { action:     q.action }),
        ...(q.entityType && { entityType: q.entityType }),
        ...(q.entityId   && { entityId:   q.entityId }),
        ...((q.from || q.to) && {
          occurredAt: {
            ...(q.from && { gte: new Date(q.from) }),
            ...(q.to   && { lte: new Date(q.to)   }),
          },
        }),
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { occurredAt: 'desc' },
          take:    q.limit + 1,
          ...(q.cursor && {
            cursor: { id: Buffer.from(q.cursor, 'base64url').toString() },
            skip:   1,
          }),
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ])

      const hasMore = logs.length > q.limit
      const data    = hasMore ? logs.slice(0, q.limit) : logs
      const cursor  = hasMore
        ? Buffer.from(data[data.length - 1].id).toString('base64url')
        : null

      res.json({
        success: true,
        data,
        meta: { cursor, hasMore, total, limit: q.limit },
      })
    } catch (err) { next(err) }
  }
)

router.get(
  '/:id',
  authenticate,
  authorize(['COMPANY_OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const log = await prisma.auditLog.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      if (!log) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Audit log not found' } })
      res.json({ success: true, data: log })
    } catch (err) { next(err) }
  }
)

export { router as auditRouter }
