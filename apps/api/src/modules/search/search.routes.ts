import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }           from '../../infrastructure/database/prisma'
import { requireCompanyId } from '../../core/utils/index'
import { z }                from 'zod'

const router: Router = Router()

const SearchQuerySchema = z.object({
  q:     z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(20).default(5),
})

router.get('/', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, limit } = SearchQuerySchema.parse(req.query)
    const companyId = requireCompanyId(req.user)
    const search = { contains: q, mode: 'insensitive' as const }

    const [customers, leads, tickets, tasks, employees] = await Promise.all([
      prisma.customer.findMany({
        where: {
          companyId, deletedAt: null,
          OR: [
            { firstName: search }, { lastName: search },
            { email: search }, { companyName: search }, { phone: search },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, companyName: true, status: true },
        take: limit,
      }),
      prisma.lead.findMany({
        where: {
          companyId, deletedAt: null,
          OR: [{ title: search }, { source: search }, { campaign: search }],
        },
        select: { id: true, title: true, stage: true, value: true, assignedTo: true },
        take: limit,
      }),
      prisma.ticket.findMany({
        where: {
          companyId, deletedAt: null,
          OR: [{ title: search }, { ticketNumber: search }, { description: search }],
        },
        select: { id: true, ticketNumber: true, title: true, status: true, priority: true },
        take: limit,
      }),
      prisma.task.findMany({
        where: {
          companyId, deletedAt: null,
          OR: [{ title: search }, { description: search }],
        },
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        take: limit,
      }),
      prisma.companyMember.findMany({
        where: {
          companyId, isActive: true,
          user: {
            deletedAt: null,
            OR: [
              { firstName: search }, { lastName: search }, { email: search },
            ],
          },
        },
        select: {
          role: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
        take: limit,
      }),
    ])

    const totalResults =
      customers.length + leads.length + tickets.length + tasks.length + employees.length

    res.json({
      success: true,
      data: {
        customers: customers.map((c: Record<string,unknown>) => ({ ...c, type: 'customer' })),
        leads:     leads.map((l: Record<string,unknown>)     => ({ ...l, type: 'lead' })),
        tickets:   tickets.map((t: Record<string,unknown>)   => ({ ...t, type: 'ticket' })),
        tasks:     tasks.map((t: Record<string,unknown>)     => ({ ...t, type: 'task' })),
        employees: employees.map((e: {user: Record<string,unknown>; role: string}) => ({ ...e.user, role: e.role, type: 'employee' })),
      },
      meta: { query: q, totalResults, durationMs: 0 },
    })
  } catch (err) { next(err) }
})

export { router as searchRouter }
