import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }           from '../../infrastructure/database/prisma'
import { CreateCalendarEventSchema, UpdateCalendarEventSchema } from '@crm/shared'
import { requireCompanyId } from '../../core/utils/index'
import { z }                from 'zod'

const router: Router = Router()

const EventQuerySchema = z.object({
  startsFrom: z.string().datetime(),
  startsTo:   z.string().datetime(),
  assignedTo: z.string().uuid().optional(),
  eventType:  z.string().optional(),
  entityType: z.string().optional(),
  entityId:   z.string().uuid().optional(),
})

router.get('/events', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = EventQuerySchema.parse(req.query)
    const events = await prisma.calendarEvent.findMany({
      where: {
        companyId: requireCompanyId(req.user),
        deletedAt: null,
        startsAt:  { gte: new Date(q.startsFrom), lte: new Date(q.startsTo) },
        ...(q.eventType  && { eventType:  q.eventType as never }),
        ...(q.entityType && { entityType: q.entityType }),
        ...(q.entityId   && { entityId:   q.entityId }),
        ...(q.assignedTo && {
          attendees: { some: { userId: q.assignedTo } },
        }),
      },
      orderBy: { startsAt: 'asc' },
      include: {
        creator:   { select: { id: true, firstName: true, lastName: true } },
        attendees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        },
      },
    })
    res.json({ success: true, data: events, meta: { total: events.length } })
  } catch (err) { next(err) }
})

router.post('/events', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto   = CreateCalendarEventSchema.parse(req.body)
    const event = await prisma.calendarEvent.create({
      data: {
        companyId:     requireCompanyId(req.user),
        createdBy:     req.user.id,
        title:         dto.title,
        description:   dto.description,
        eventType:     dto.eventType as never,
        startsAt:      new Date(dto.startsAt),
        endsAt:        dto.endsAt ? new Date(dto.endsAt) : undefined,
        allDay:        dto.allDay,
        location:      dto.location,
        entityType:    dto.entityType,
        entityId:      dto.entityId,
        reminderMins:  dto.reminderMins,
        recurrenceRule:dto.recurrenceRule,
        attendees: dto.attendeeIds?.length
          ? { create: [{ userId: req.user.id, status: 'ACCEPTED' }, ...dto.attendeeIds.filter(id => id !== req.user.id).map(id => ({ userId: id, status: 'PENDING' }))] }
          : { create: [{ userId: req.user.id, status: 'ACCEPTED' }] },
      },
      include: {
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    })
    res.status(201).json({ success: true, data: event })
  } catch (err) { next(err) }
})

router.get('/upcoming', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      where: {
        companyId: requireCompanyId(req.user),
        deletedAt: null,
        startsAt:  { gte: new Date() },
        attendees: { some: { userId: req.user.id } },
      },
      orderBy: { startsAt: 'asc' },
      take:    10,
      include: {
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    })
    res.json({ success: true, data: events })
  } catch (err) { next(err) }
})

router.get('/events/:id', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.calendarEvent.findFirst({
      where:   { id: req.params.id, companyId: requireCompanyId(req.user), deletedAt: null },
      include: { attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
    })
    if (!event) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } })
    res.json({ success: true, data: event })
  } catch (err) { next(err) }
})

router.patch('/events/:id', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto   = UpdateCalendarEventSchema.parse(req.body)
    const updateData: Record<string, unknown> = { ...dto }
    if (dto.startsAt) updateData['startsAt'] = new Date(dto.startsAt)
    if (dto.endsAt)   updateData['endsAt']   = new Date(dto.endsAt)
    const event = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data:  updateData as never,
    })
    res.json({ success: true, data: event })
  } catch (err) { next(err) }
})

router.delete('/events/:id', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.calendarEvent.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as calendarRouter }
