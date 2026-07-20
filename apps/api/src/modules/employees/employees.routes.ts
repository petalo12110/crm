import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }           from '../../infrastructure/database/prisma'
import { requireCompanyId } from '../../core/utils/index'
import { z }                from 'zod'

const router: Router = Router()

router.get('/', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const { department, role, search } = req.query as Record<string, string>
    const members = await prisma.companyMember.findMany({
      where: {
        companyId,
        isActive:  true,
        ...(department && { department: { contains: department, mode: 'insensitive' as const } }),
        ...(role       && { role: role as never }),
        ...(search     && {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName:  { contains: search, mode: 'insensitive' as const } },
              { email:     { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, avatarUrl: true, lastLoginAt: true, isActive: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })
    res.json({ success: true, data: members, meta: { total: members.length } })
  } catch (err) { next(err) }
})

router.get('/performance', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const members = await prisma.companyMember.findMany({
      where:   { companyId, isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    })

    const performance = await Promise.all(
      members.map(async (m: typeof members[0]) => {
        const [leadsCreated, leadsWon, ticketsResolved, tasksCompleted] = await Promise.all([
          prisma.lead.count({ where: { companyId, ownerId: m.userId, createdAt: { gte: monthStart } } }),
          prisma.lead.count({ where: { companyId, assignedTo: m.userId, stage: 'WON', updatedAt: { gte: monthStart } } }),
          prisma.ticket.count({ where: { companyId, assignedTo: m.userId, status: { in: ['RESOLVED','CLOSED'] as never[] }, updatedAt: { gte: monthStart } } }),
          prisma.task.count({ where: { companyId, assignedTo: m.userId, status: 'COMPLETED', completedAt: { gte: monthStart } } }),
        ])

        const revenueAgg = await prisma.opportunity.aggregate({
          where: { companyId, assignedTo: m.userId, stage: 'CLOSED_WON', updatedAt: { gte: monthStart } },
          _sum:  { expectedRevenue: true },
        })

        return {
          employee:         m.user,
          role:             m.role,
          department:       m.department,
          leadsCreated,
          leadsWon,
          conversionRate:   leadsCreated > 0 ? Math.round((leadsWon / leadsCreated) * 1000) / 10 : 0,
          revenueGenerated: Number(revenueAgg._sum?.expectedRevenue ?? 0),
          ticketsResolved,
          tasksCompleted,
          period: { from: monthStart.toISOString(), to: new Date().toISOString() },
        }
      })
    )

    res.json({ success: true, data: performance })
  } catch (err) { next(err) }
})

router.get('/:id', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.companyMember.findFirst({
      where:   { id: req.params.id, companyId: requireCompanyId(req.user) },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            phone: true, avatarUrl: true, lastLoginAt: true, createdAt: true,
          },
        },
      },
    })
    if (!member) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } })
    res.json({ success: true, data: member })
  } catch (err) { next(err) }
})

router.get('/:id/tasks', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const member = await prisma.companyMember.findFirst({
      where: { id: req.params.id, companyId },
    })
    if (!member) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } })

    const tasks = await prisma.task.findMany({
      where:   { companyId, assignedTo: member.userId, deletedAt: null },
      orderBy: { dueDate: 'asc' },
      take:    50,
    })
    res.json({ success: true, data: tasks, meta: { total: tasks.length } })
  } catch (err) { next(err) }
})

router.get('/:id/activity', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const member = await prisma.companyMember.findFirst({
      where: { id: req.params.id, companyId },
    })
    if (!member) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } })

    const logs = await prisma.auditLog.findMany({
      where:   { companyId, userId: member.userId },
      orderBy: { occurredAt: 'desc' },
      take:    50,
    })
    res.json({ success: true, data: logs })
  } catch (err) { next(err) }
})

export { router as employeesRouter }
