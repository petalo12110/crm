import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }           from '../../infrastructure/database/prisma'
import { cache, CacheService } from '../../infrastructure/cache/CacheService'
import { requireCompanyId } from '../../core/utils'

const router: Router = Router()

// ── Dashboard summary ──────────────────────────────────────

router.get('/summary', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId      = requireCompanyId(req.user)
    const cacheKey      = CacheService.key('dashboard', companyId, 'summary')
    const cached        = await cache.get(cacheKey)
    if (cached) return res.json({ success: true, data: cached })

    const now     = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0)

    const [
      totalCustomers, newCustomers, openLeads, wonLeads, openTickets,
      slaBreached, myTasks, myOverdue, totalRevenue, prevRevenue,
    ] = await Promise.all([
      prisma.customer.count({ where: { companyId, deletedAt: null } }),
      prisma.customer.count({ where: { companyId, deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { companyId, deletedAt: null, stage: { notIn: ['WON','LOST','ARCHIVED'] as never[] } } }),
      prisma.lead.count({ where: { companyId, deletedAt: null, stage: 'WON', updatedAt: { gte: monthStart } } }),
      prisma.ticket.count({ where: { companyId, deletedAt: null, status: { notIn: ['RESOLVED','CLOSED'] as never[] } } }),
      prisma.ticket.count({ where: { companyId, deletedAt: null, slaBreached: true } }),
      prisma.task.count({ where: { companyId, deletedAt: null, assignedTo: req.user.id, status: { notIn: ['COMPLETED','CANCELLED'] as never[] } } }),
      prisma.task.count({ where: { companyId, deletedAt: null, assignedTo: req.user.id, status: { notIn: ['COMPLETED','CANCELLED'] as never[] }, dueDate: { lt: now } } }),
      // Revenue = sum of WON opportunity expected revenue this month
      prisma.opportunity.aggregate({ where: { companyId, deletedAt: null, stage: 'CLOSED_WON', updatedAt: { gte: monthStart } }, _sum: { expectedRevenue: true } }),
      prisma.opportunity.aggregate({ where: { companyId, deletedAt: null, stage: 'CLOSED_WON', updatedAt: { gte: prevStart, lte: prevEnd } }, _sum: { expectedRevenue: true } }),
    ])

    const current  = Number(totalRevenue._sum.expectedRevenue ?? 0)
    const previous = Number(prevRevenue._sum.expectedRevenue ?? 0)
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0

    const data = {
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      revenue: { current, previous, changePercent: Math.round(changePct * 10) / 10 },
      leads: { open: openLeads, wonThisMonth: wonLeads },
      tickets: { open: openTickets, slaBreached },
      tasks: { myOpen: myTasks, myOverdue },
      customers: { total: totalCustomers, newThisMonth: newCustomers },
    }

    await cache.set(cacheKey, data, 120) // 2-minute cache
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// ── Sales trend ────────────────────────────────────────────

router.get('/sales-trend', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    // Last 12 months
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      return new Date(d.getFullYear(), d.getMonth(), 1)
    })

    const trend = await Promise.all(
      months.map(async monthStart => {
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
        const agg = await prisma.opportunity.aggregate({
          where: { companyId, deletedAt: null, stage: 'CLOSED_WON', updatedAt: { gte: monthStart, lte: monthEnd } },
          _sum: { expectedRevenue: true },
          _count: { id: true },
        })
        return {
          month:   `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2,'0')}`,
          // Prisma types _sum/_count as possibly undefined here (a real
          // compile-time inference gap inside this .map() closure, not a
          // runtime possibility — aggregate() always returns these keys
          // when they're requested) — optional-chain + cast rather than
          // fight the inference.
          revenue: Number(agg._sum?.expectedRevenue ?? 0),
          deals:   (agg._count as { id: number } | undefined)?.id ?? 0,
        }
      })
    )

    res.json({ success: true, data: trend })
  } catch (err) { next(err) }
})

// ── Pipeline overview ──────────────────────────────────────

router.get('/pipeline', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = await prisma.lead.groupBy({
      by:    ['stage'],
      where: { companyId: requireCompanyId(req.user), deletedAt: null },
      _count:{ stage: true },
      _sum:  { value: true },
    })
    res.json({ success: true, data: stages })
  } catch (err) { next(err) }
})

// ── Top performers ─────────────────────────────────────────

router.get('/top-performers', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const performers = await prisma.opportunity.groupBy({
      by:    ['assignedTo'],
      where: { companyId: requireCompanyId(req.user), deletedAt: null, stage: 'CLOSED_WON', updatedAt: { gte: monthStart } },
      _sum:  { expectedRevenue: true },
      _count:{ id: true },
      orderBy:{ _sum: { expectedRevenue: 'desc' } },
      take:  5,
    })

    // Hydrate with user names
    const hydrated = await Promise.all(
      performers.map(async (p: typeof performers[0]) => {
        const user = p.assignedTo
          ? await prisma.user.findUnique({ where: { id: p.assignedTo }, select: { id: true, firstName: true, lastName: true } })
          : null
        return {
          employee:         user,
          revenueGenerated: Number(p._sum?.expectedRevenue ?? 0),
          dealsWon:         (p._count as { id: number } | undefined)?.id ?? 0,
        }
      })
    )

    res.json({ success: true, data: hydrated })
  } catch (err) { next(err) }
})

// ── Recent activity ────────────────────────────────────────

router.get('/recent-activity', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where:   { companyId: requireCompanyId(req.user) },
      orderBy: { occurredAt: 'desc' },
      take:    20,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    })
    res.json({ success: true, data: logs })
  } catch (err) { next(err) }
})

export { router as dashboardRouter }
