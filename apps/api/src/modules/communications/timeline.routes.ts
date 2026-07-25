import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }   from '../../delivery/middleware/authenticate'
import { authorize }      from '../../delivery/middleware/authorize'
import { timelineService } from './timeline.service'
import { requireCompanyId } from '../../core/utils'
import { z }              from 'zod'

const router: Router = Router({ mergeParams: true })

const AddEntrySchema = z.object({
  entryType:  z.enum(['EMAIL','CALL','SMS','NOTE','MEETING','SYSTEM']),
  direction:  z.enum(['INBOUND','OUTBOUND','INTERNAL']).default('INTERNAL'),
  subject:    z.string().max(500).optional(),
  body:       z.string().max(10000).optional(),
  occurredAt: z.string().datetime().optional(),
  metadata:   z.record(z.unknown()).optional(),
})

router.get(
  '/',
  authenticate,
  authorize(['COMPANY_OWNER','MANAGER','SALES_REP','SUPPORT']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await timelineService.listForCustomer(
        req.params.customerId,
        requireCompanyId(req.user),
        {
          type:   req.query.type as string | undefined,
          limit:  Number(req.query.limit) || 25,
          cursor: req.query.cursor as string | undefined,
        }
      )
      res.json({ success: true, ...result })
    } catch (err) { next(err) }
  }
)

router.post(
  '/',
  authenticate,
  authorize(['COMPANY_OWNER','MANAGER','SALES_REP','SUPPORT']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AddEntrySchema.parse(req.body)
      await timelineService.addEntry({
        companyId:  requireCompanyId(req.user),
        customerId: req.params.customerId,
        userId:     req.user.id,
        ...body,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      })
      res.status(201).json({ success: true })
    } catch (err) { next(err) }
  }
)

export { router as timelineRouter }
