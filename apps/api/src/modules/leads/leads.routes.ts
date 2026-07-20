import { Router, Request, Response, NextFunction } from 'express'
import { LeadsService }        from './leads.service'
import { LeadsRepository }     from './leads.repository'
import { AuditService }        from '../audit/audit.service'
import { TimelineService }     from '../communications/timeline.service'
import { NotificationsService } from '../notifications/notifications.service'
import { authenticate }        from '../../delivery/middleware/authenticate'
import { authorize, ROLES }    from '../../delivery/middleware/authorize'
import {
  LeadFiltersSchema,
  CreateLeadSchema,
  UpdateLeadSchema,
  TransitionLeadStageSchema,
  ConvertLeadSchema,
} from '@crm/shared'

const service = new LeadsService(
  new LeadsRepository(),
  new AuditService(),
  new TimelineService(),
  new NotificationsService(),
)

const router: import("express").Router = Router()

// ── IMPORTANT: static routes MUST come before /:id ──────────
// /pipeline before /:id — otherwise Express matches "pipeline" as an ID and returns 404

router.get('/pipeline', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = await service.getPipeline(req.user)
    res.json({ success: true, data: stages })
  } catch (err) { next(err) }
})

router.get('/', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = LeadFiltersSchema.parse(req.query)
    const result  = await service.list(req.user, filters)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.post('/', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto  = CreateLeadSchema.parse(req.body)
    const data = await service.create(req.user, dto)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
})

router.get('/:id', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getById(req.user, req.params.id)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.patch('/:id', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto  = UpdateLeadSchema.parse(req.body)
    const data = await service.update(req.user, req.params.id, dto)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.patch('/:id/stage', authenticate, authorize(ROLES.SALES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto  = TransitionLeadStageSchema.parse(req.body)
    const data = await service.transitionStage(req.user, req.params.id, dto)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.post('/:id/convert', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto  = ConvertLeadSchema.parse(req.body)
    const data = await service.convertToCustomer(req.user, req.params.id, dto)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.delete('/:id', authenticate, authorize(ROLES.CAN_DELETE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.softDelete(req.user, req.params.id)
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as leadsRouter }
