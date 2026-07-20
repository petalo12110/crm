import { Router, Request, Response, NextFunction } from 'express'
import { z }                from 'zod'
import { prisma }           from '../../infrastructure/database/prisma'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { auditService }     from '../audit/audit.service'
import { NotFoundError }    from '../../core/errors/index'
import { requireCompanyId } from '../../core/utils/index'

const router: import("express").Router = Router()

const CreateOpportunitySchema = z.object({
  title:           z.string().min(1).max(255),
  customerId:      z.string().uuid().optional().nullable(),
  leadId:          z.string().uuid().optional().nullable(),
  stage:           z.enum([
    'PROSPECTING','QUALIFICATION','NEEDS_ANALYSIS','VALUE_PROPOSITION',
    'DECISION_MAKERS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST',
  ]).default('PROSPECTING'),
  expectedRevenue: z.coerce.number().nonnegative().optional().nullable(),
  probability:     z.coerce.number().min(0).max(100).optional().nullable(),
  expectedClose:   z.string().optional().nullable(),
  quotedValue:     z.coerce.number().nonnegative().optional().nullable(),
  competitors:     z.array(z.string()).optional().default([]),
  products:        z.array(z.string()).optional().default([]),
  assignedTo:      z.string().uuid().optional().nullable(),
  notes:           z.string().max(10000).optional().nullable(),
})

const UpdateOpportunitySchema = CreateOpportunitySchema.partial()

// Static routes BEFORE /:id
router.get('/pipeline', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const stages = await prisma.opportunity.groupBy({
      by:    ['stage'],
      where: { companyId, deletedAt: null },
      _count:{ id: true },
      _sum:  { expectedRevenue: true },
    })
    const totalPipeline = await prisma.opportunity.aggregate({
      where: { companyId, deletedAt: null, stage: { notIn: ['CLOSED_WON','CLOSED_LOST'] as never[] } },
      _sum:  { expectedRevenue: true },
    })
    res.json({ success: true, data: { stages, totalPipelineValue: totalPipeline._sum?.expectedRevenue ?? 0 } })
  } catch (err) { next(err) }
})

// List
router.get('/', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const { stage, limit = '100', cursor } = req.query as Record<string, string>

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      ...(stage ? { stage: stage as never } : {}),
    }

    const take  = Math.min(parseInt(limit), 100)
    const [items, total] = await Promise.all([
      prisma.opportunity.findMany({
        where:   where as never,
        orderBy: { createdAt: 'desc' },
        take:    take + 1,
        ...(cursor ? { cursor: { id: Buffer.from(cursor, 'base64url').toString() }, skip: 1 } : {}),
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          lead:     { select: { id: true, title: true } },
        },
      }),
      prisma.opportunity.count({ where: where as never }),
    ])

    const hasMore = items.length > take
    const data    = hasMore ? items.slice(0, take) : items
    const nextCursor = hasMore ? Buffer.from(data[data.length - 1].id).toString('base64url') : null

    res.json({ success: true, data, meta: { cursor: nextCursor, hasMore, total, limit: take } })
  } catch (err) { next(err) }
})

// Create
router.post('/', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const dto  = CreateOpportunitySchema.parse(req.body)
    const data = await prisma.opportunity.create({
      data: {
        companyId,
        title:           dto.title,
        stage:           dto.stage as never,
        customerId:      dto.customerId,
        leadId:          dto.leadId,
        expectedRevenue: dto.expectedRevenue,
        probability:     dto.probability,
        expectedClose:   dto.expectedClose ? new Date(dto.expectedClose) : undefined,
        quotedValue:     dto.quotedValue,
        competitors:     dto.competitors,
        products:        dto.products,
        assignedTo:      dto.assignedTo,
        notes:           dto.notes,
      },
    })
    await auditService.log({
      companyId, userId: req.user.id,
      action: 'CREATE', entityType: 'opportunities', entityId: data.id,
      newValues: dto as Record<string, unknown>,
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
})

// Get by ID
router.get('/:id', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.opportunity.findFirst({
      where: { id: req.params.id, companyId: requireCompanyId(req.user), deletedAt: null },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        stageHistory: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!data) throw new NotFoundError('Opportunity not found')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// Update
router.patch('/:id', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const dto      = UpdateOpportunitySchema.parse(req.body)
    const existing = await prisma.opportunity.findFirst({
      where: { id: req.params.id, companyId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Opportunity not found')

    const updateData: Record<string, unknown> = {}
    if (dto.title           !== undefined) updateData.title           = dto.title
    if (dto.stage           !== undefined) updateData.stage           = dto.stage
    if (dto.expectedRevenue !== undefined) updateData.expectedRevenue = dto.expectedRevenue
    if (dto.probability     !== undefined) updateData.probability     = dto.probability
    if (dto.quotedValue     !== undefined) updateData.quotedValue     = dto.quotedValue
    if (dto.assignedTo      !== undefined) updateData.assignedTo      = dto.assignedTo
    if (dto.notes           !== undefined) updateData.notes           = dto.notes
    if (dto.competitors     !== undefined) updateData.competitors     = dto.competitors
    if (dto.products        !== undefined) updateData.products        = dto.products
    if (dto.expectedClose   !== undefined) {
      updateData.expectedClose = dto.expectedClose ? new Date(dto.expectedClose) : null
    }

    // Record stage change
    if (dto.stage && dto.stage !== existing.stage) {
      await prisma.opportunityStageHistory.create({
        data: { oppId: existing.id, fromStage: existing.stage, toStage: dto.stage as never, changedBy: req.user.id },
      })
    }

    const data = await prisma.opportunity.update({ where: { id: req.params.id }, data: updateData as never })
    await auditService.log({
      companyId, userId: req.user.id,
      action: 'UPDATE', entityType: 'opportunities', entityId: req.params.id,
      oldValues: existing as Record<string, unknown>, newValues: dto as Record<string, unknown>,
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// Soft delete
router.delete('/:id', authenticate, authorize(ROLES.CAN_DELETE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const existing = await prisma.opportunity.findFirst({
      where: { id: req.params.id, companyId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Opportunity not found')
    await prisma.opportunity.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
    await auditService.log({
      companyId, userId: req.user.id,
      action: 'DELETE', entityType: 'opportunities', entityId: req.params.id,
    })
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as opportunitiesRouter }
