import { Router, Request, Response, NextFunction } from 'express'
import { BaseRepository }      from '../../infrastructure/database/BaseRepository'
import { AuditService }        from '../audit/audit.service'
import { TimelineService }     from '../communications/timeline.service'
import { NotificationsService } from '../notifications/notifications.service'
import { authenticate }        from '../../delivery/middleware/authenticate'
import { authorize, ROLES }    from '../../delivery/middleware/authorize'
import { NotFoundError, ForbiddenError } from '../../core/errors/index'
import { requireCompanyId }    from '../../core/utils/index'
import { prisma }              from '../../infrastructure/database/prisma'
import type { AuthUser }       from '../../core/types/index'
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  TicketFiltersSchema,
  CreateTicketReplySchema,
  EscalateTicketSchema,
} from '@crm/shared'

// ── Repository ─────────────────────────────────────────────

class TicketsRepository extends BaseRepository {
  async findMany(companyId: string, filters: Record<string, unknown>) {
    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      ...(filters.status ? { status:      filters.status as never } : {}),
      ...(filters.priority ? { priority:    filters.priority as never } : {}),
      ...(filters.assignedTo ? { assignedTo:  filters.assignedTo as string } : {}),
      ...(filters.customerId ? { customerId:  filters.customerId as string } : {}),
      ...(filters.department ? { department:  { contains: filters.department as string, mode: 'insensitive' as const } } : {}),
      ...(filters.slaBreached !== undefined ? { slaBreached: filters.slaBreached as boolean } : {}),
      ...(filters.search ? {
        OR: [
          { title:       { contains: filters.search as string, mode: 'insensitive' as const } },
          { description: { contains: filters.search as string, mode: 'insensitive' as const } },
          { ticketNumber:{ contains: filters.search as string } },
        ],
      } : {}),
    }

    const limit  = (filters.limit as number) ?? 25
    const cursor = filters.cursor as string | undefined
    const [items, total] = await this.db.$transaction([
      this.db.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        ...this.buildCursorArgs(cursor, limit),
      }),
      this.db.ticket.count({ where }),
    ])

    const { data, meta } = this.buildPageResult(items, limit)
    return { data, meta: { ...meta, total } }
  }

  async findById(id: string, companyId: string) {
    return this.db.ticket.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        creator:  { select: { id: true, firstName: true, lastName: true } },
        replies: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })
  }

  async getNextTicketNumber(companyId: string): Promise<string> {
    const count = await this.db.ticket.count({ where: { companyId } })
    return `TKT-${String(count + 1).padStart(6, '0')}`
  }

  async create(companyId: string, data: Record<string, unknown>, createdBy: string) {
    const ticketNumber = await this.getNextTicketNumber(companyId)
    return this.db.ticket.create({
      data: {
        companyId,
        createdBy,
        ticketNumber,
        title:       data.title as string,
        description: data.description as string | undefined,
        priority:    (data.priority ?? 'MEDIUM') as never,
        customerId:  data.customerId as string | undefined,
        department:  data.department as string | undefined,
        category:    data.category   as string | undefined,
        assignedTo:  data.assignedTo as string | undefined,
        slaDeadline: data.slaDeadline ? new Date(data.slaDeadline as string) : undefined,
      },
    })
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.db.ticket.update({ where: { id }, data: data as never })
  }

  async addReply(ticketId: string, userId: string, body: string, isInternal: boolean) {
    const [reply] = await this.db.$transaction([
      this.db.ticketReply.create({
        data: { ticketId, userId, body, isInternal },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      // Mark first response time if not already set
      this.db.ticket.updateMany({
        where: { id: ticketId, firstResponseAt: null },
        data:  { firstResponseAt: new Date() },
      }),
    ])
    return reply
  }

  async softDelete(id: string) {
    return this.db.ticket.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}

// ── Service ────────────────────────────────────────────────

class TicketsService {
  constructor(
    private readonly repo:          TicketsRepository,
    private readonly audit:         AuditService,
    private readonly timeline:      TimelineService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, filters: Record<string, unknown>) {
    return this.repo.findMany(requireCompanyId(user), filters)
  }

  async getById(user: AuthUser, ticketId: string) {
    const ticket = await this.repo.findById(ticketId, requireCompanyId(user))
    if (!ticket) throw new NotFoundError('Ticket not found')
    return ticket
  }

  async create(user: AuthUser, dto: Record<string, unknown>) {
    const companyId = requireCompanyId(user)
    const ticket = await this.repo.create(companyId, dto, user.id)

    await Promise.all([
      this.audit.log({
        companyId, userId: user.id,
        action: 'CREATE', entityType: 'tickets', entityId: ticket.id,
        newValues: dto,
      }),
      ticket.customerId && this.timeline.addEntry({
        companyId, customerId: ticket.customerId,
        entryType: 'TICKET', direction: 'INBOUND',
        subject:   `Ticket created: ${ticket.title}`,
        userId:    user.id, refEntityType: 'TICKET', refEntityId: ticket.id,
        metadata:  { ticketNumber: ticket.ticketNumber, priority: ticket.priority },
      }),
      ticket.assignedTo && ticket.assignedTo !== user.id && this.notifications.create({
        companyId, userId: ticket.assignedTo,
        type: 'TICKET_ASSIGNED', title: `New ticket assigned: ${ticket.title}`,
        entityType: 'TICKET', entityId: ticket.id,
        url: `/tickets/${ticket.id}`,
      }),
    ])

    return ticket
  }

  async reply(user: AuthUser, ticketId: string, body: string, isInternal: boolean) {
    const companyId = requireCompanyId(user)
    const ticket = await this.getById(user, ticketId)
    const reply  = await this.repo.addReply(ticketId, user.id, body, isInternal)

    if (!isInternal && ticket.customerId) {
      await this.timeline.addEntry({
        companyId, customerId: ticket.customerId,
        entryType: 'TICKET', direction: 'OUTBOUND',
        subject:   `Reply on ticket ${ticket.ticketNumber}`,
        body,
        userId:    user.id, refEntityType: 'TICKET', refEntityId: ticketId,
      })
    }

    return reply
  }

  async updateStatus(user: AuthUser, ticketId: string, status: string) {
    const companyId = requireCompanyId(user)
    const ticket  = await this.getById(user, ticketId)
    const updated = await this.repo.update(ticketId, {
      status,
      ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
      ...(status === 'CLOSED'   && { closedAt:   new Date() }),
    })

    await this.audit.log({
      companyId, userId: user.id,
      action: 'UPDATE', entityType: 'tickets', entityId: ticketId,
      oldValues: { status: ticket.status }, newValues: { status },
    })

    if (ticket.customerId) {
      await this.timeline.addEntry({
        companyId, customerId: ticket.customerId,
        entryType: 'TICKET', direction: 'INTERNAL',
        subject:   `Ticket ${ticket.ticketNumber} status: ${ticket.status} → ${status}`,
        userId:    user.id, refEntityType: 'TICKET', refEntityId: ticketId,
      })
    }

    return updated
  }

  async escalate(user: AuthUser, ticketId: string, dto: Record<string, unknown>) {
    const companyId = requireCompanyId(user)
    const ticket = await this.getById(user, ticketId)
    const updated = await this.repo.update(ticketId, {
      escalatedTo: dto.escalateTo,
      escalatedAt: new Date(),
      ...(dto.newPriority ? { priority: dto.newPriority } : {}),
    })

    await this.notifications.create({
      companyId, userId: dto.escalateTo as string,
      type: 'TICKET_ASSIGNED',
      title: `Ticket escalated to you: ${ticket.title}`,
      body:  dto.reason as string,
      entityType: 'TICKET', entityId: ticketId,
      url: `/tickets/${ticketId}`, priority: 3,
    })

    return updated
  }

  async softDelete(user: AuthUser, ticketId: string) {
    const companyId = requireCompanyId(user)
    await this.getById(user, ticketId)
    await this.repo.softDelete(ticketId)
    await this.audit.log({
      companyId, userId: user.id,
      action: 'DELETE', entityType: 'tickets', entityId: ticketId,
    })
  }
}

// ── Routes ─────────────────────────────────────────────────

const svc    = new TicketsService(
  new TicketsRepository(), new AuditService(), new TimelineService(), new NotificationsService()
)
const router: Router = Router()
const SUPPORT_ROLES = ['COMPANY_OWNER','MANAGER','SUPPORT']

router.get('/', authenticate, authorize(SUPPORT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = TicketFiltersSchema.parse(req.query)
    res.json({ success: true, ...await svc.list(req.user, filters as Record<string, unknown>) })
  } catch (err) { next(err) }
})

router.post('/', authenticate, authorize(SUPPORT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateTicketSchema.parse(req.body)
    res.status(201).json({ success: true, data: await svc.create(req.user, dto as Record<string, unknown>) })
  } catch (err) { next(err) }
})

router.get('/:id', authenticate, authorize(SUPPORT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await svc.getById(req.user, req.params.id) })
  } catch (err) { next(err) }
})

router.patch('/:id', authenticate, authorize(SUPPORT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto  = UpdateTicketSchema.parse(req.body)
    const data = await prisma.ticket.update({ where: { id: req.params.id }, data: dto as never })
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.patch('/:id/status', authenticate, authorize(SUPPORT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body
    res.json({ success: true, data: await svc.updateStatus(req.user, req.params.id, status) })
  } catch (err) { next(err) }
})

router.post('/:id/replies', authenticate, authorize(SUPPORT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, isInternal } = CreateTicketReplySchema.parse(req.body)
    res.status(201).json({ success: true, data: await svc.reply(req.user, req.params.id, body, isInternal) })
  } catch (err) { next(err) }
})

router.post('/:id/escalate', authenticate, authorize(ROLES.MANAGEMENT.concat(['SUPPORT'])), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = EscalateTicketSchema.parse(req.body)
    res.json({ success: true, data: await svc.escalate(req.user, req.params.id, dto as Record<string, unknown>) })
  } catch (err) { next(err) }
})

router.delete('/:id', authenticate, authorize(ROLES.CAN_DELETE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.softDelete(req.user, req.params.id)
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as ticketsRouter }
