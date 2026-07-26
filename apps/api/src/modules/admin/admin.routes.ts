import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { adminService }     from './admin.service'
import { auditService }     from '../audit/audit.service'

const router: Router = Router()

const SmtpSettingsSchema = z.object({
  emailProvider: z.enum(['smtp', 'resend']).default('smtp'),
  host:      z.string().max(255).optional(),
  port:      z.coerce.number().int().min(1).max(65535).optional(),
  secure:    z.boolean().default(false),
  user:      z.string().max(255).optional(),
  pass:      z.string().max(500).optional(), // omit to keep existing password
  resendApiKey: z.string().max(500).optional(), // omit to keep existing key
  emailFrom: z.string().email('Must be a valid email address'),
}).refine(
  dto => dto.emailProvider !== 'smtp' || !!dto.host?.trim(),
  { message: 'SMTP host is required when using the SMTP provider.', path: ['host'] }
).refine(
  dto => dto.emailProvider !== 'smtp' || !!dto.port,
  { message: 'SMTP port is required when using the SMTP provider.', path: ['port'] }
)

const TestSmtpSchema = z.object({
  recipient: z.string().email(),
  settings:  SmtpSettingsSchema.optional(), // omit to test the currently-saved config
})

router.get('/settings/smtp', authenticate, authorize(ROLES.SUPER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await adminService.getSmtpSettings()
    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
})

router.put('/settings/smtp', authenticate, authorize(ROLES.SUPER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = SmtpSettingsSchema.parse(req.body)
    const settings = await adminService.updateSmtpSettings(dto, req.user.id)

    await auditService.log({
      userId:   req.user.id,
      action:   'SETTINGS_CHANGE',
      entityType: 'system_settings',
      entityId:   'smtp',
      newValues:  { emailProvider: dto.emailProvider, host: dto.host, port: dto.port, secure: dto.secure, user: dto.user, emailFrom: dto.emailFrom },
    })

    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
})

router.post('/settings/smtp/test', authenticate, authorize(ROLES.SUPER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = TestSmtpSchema.parse(req.body)
    const result = await adminService.testSmtpSettings(dto.recipient, dto.settings)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

export const adminRouter = router
