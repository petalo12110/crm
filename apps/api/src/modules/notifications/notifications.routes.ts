import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }           from '../../delivery/middleware/authenticate'
import { notificationsService }   from './notifications.service'
import { requireCompanyId }       from '../../core/utils'

const router: Router = Router()

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit  = Number(req.query.limit) || 25
    const cursor = req.query.cursor as string | undefined
    const result = await notificationsService.listForUser(req.user.id, requireCompanyId(req.user), limit, cursor)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationsService.getUnreadCount(req.user.id)
    res.json({ success: true, data: { count } })
  } catch (err) { next(err) }
})

router.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationsService.markRead(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationsService.markAllRead(req.user.id, requireCompanyId(req.user))
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationsService.delete(req.params.id, req.user.id)
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as notificationsRouter }
