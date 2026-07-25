import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticatePortal } from '../../delivery/middleware/authenticatePortal'
import { portalService }      from './portal.service'
import { authRateLimiter }    from '../../delivery/middleware/rateLimiter'

const router: Router = Router()

const RequestLinkSchema = z.object({
  email: z.string().email(),
})

const VerifySchema = z.object({
  token: z.string().min(1),
})

const CreateTicketSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  priority:    z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
})

const ReplySchema = z.object({
  body: z.string().min(1).max(5000),
})

// ── Auth (no token required) ──────────────────────────────

router.post('/:companySlug/auth/request-link', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = RequestLinkSchema.parse(req.body)
    await portalService.requestLoginLink(req.params.companySlug, dto.email)
    // Always the same response regardless of whether the email matched a
    // customer — don't leak which emails exist in the system.
    res.json({ success: true, data: { message: 'If that email is on file, a login link is on its way.' } })
  } catch (err) { next(err) }
})

router.post('/:companySlug/auth/verify', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = VerifySchema.parse(req.body)
    const result = await portalService.verifyLoginLink(req.params.companySlug, dto.token)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// ── Authenticated portal routes ───────────────────────────

router.get('/me', authenticatePortal, async (req: Request, res: Response) => {
  res.json({ success: true, data: req.portalCustomer })
})

router.get('/tickets', authenticatePortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = await portalService.listMyTickets(req.portalCustomer!)
    res.json({ success: true, data: tickets })
  } catch (err) { next(err) }
})

router.get('/tickets/:id', authenticatePortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await portalService.getMyTicket(req.portalCustomer!, req.params.id)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
})

router.post('/tickets', authenticatePortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateTicketSchema.parse(req.body)
    const ticket = await portalService.createTicket(req.portalCustomer!, dto)
    res.status(201).json({ success: true, data: ticket })
  } catch (err) { next(err) }
})

router.post('/tickets/:id/reply', authenticatePortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = ReplySchema.parse(req.body)
    const reply = await portalService.addReply(req.portalCustomer!, req.params.id, dto.body)
    res.status(201).json({ success: true, data: reply })
  } catch (err) { next(err) }
})

export { router as portalRouter }
