import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }           from '../../infrastructure/database/prisma'
import { auditService }     from '../audit/audit.service'
import { encrypt, requireCompanyId } from '../../core/utils/index'
import { UpdateCompanySettingsSchema, UpdateSmtpSettingsSchema } from '@crm/shared'
import { z }                from 'zod'

const router: Router = Router()

// Get company settings
router.get('/', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({
      where:  { id: requireCompanyId(req.user), deletedAt: null },
      select: {
        id: true, name: true, slug: true, email: true, phone: true,
        addressLine1: true, city: true, province: true, postalCode: true, country: true,
        website: true, logoUrl: true, primaryColor: true, accentColor: true,
        timezone: true, currency: true, language: true, dateFormat: true,
        workingHoursStart: true, workingHoursEnd: true,
        taxLabel: true, taxRate: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpFrom: true,
        // Never return smtpPassEncrypted
        createdAt: true, updatedAt: true,
        subscription: true,
      },
    })
    res.json({ success: true, data: company })
  } catch (err) { next(err) }
})

// Update general settings
router.patch('/', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = requireCompanyId(req.user)
    const dto     = UpdateCompanySettingsSchema.parse(req.body)
    const old     = await prisma.company.findUnique({ where: { id: companyId } })
    const company = await prisma.company.update({ where: { id: companyId }, data: dto })

    await auditService.log({
      companyId,
      userId:     req.user.id,
      action:     'SETTINGS_CHANGE',
      entityType: 'companies',
      entityId:   companyId,
      oldValues:  old as Record<string, unknown>,
      newValues:  dto as Record<string, unknown>,
    })

    res.json({ success: true, data: company })
  } catch (err) { next(err) }
})

// Update SMTP settings (credentials are encrypted at rest)
router.patch('/email', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto     = UpdateSmtpSettingsSchema.parse(req.body)
    const company = await prisma.company.update({
      where: { id: requireCompanyId(req.user) },
      data: {
        smtpHost:          dto.smtpHost,
        smtpPort:          dto.smtpPort,
        smtpUser:          dto.smtpUser,
        smtpPassEncrypted: encrypt(dto.smtpPass),
        smtpFrom:          dto.smtpFrom,
      },
    })
    res.json({ success: true, data: { smtpHost: company.smtpHost, smtpPort: company.smtpPort, smtpFrom: company.smtpFrom } })
  } catch (err) { next(err) }
})

// Test SMTP settings
router.post('/email/test', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { SmtpEmailProvider } = await import('../../infrastructure/email/EmailProvider')
    const company = await prisma.company.findUnique({ where: { id: requireCompanyId(req.user) } })
    if (!company?.smtpHost) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'SMTP settings not configured' } })
    }
    const provider = new SmtpEmailProvider()
    const ok = await provider.verify()
    res.json({ success: true, data: { connected: ok } })
  } catch (err) { next(err) }
})

// ── Custom fields ──────────────────────────────────────────

const CreateCustomFieldSchema = z.object({
  entityType:   z.enum(['CUSTOMER','LEAD','OPPORTUNITY','TICKET']),
  fieldKey:     z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/, 'Must be snake_case'),
  label:        z.string().min(1).max(255),
  fieldType:    z.enum(['TEXT','NUMBER','DATE','BOOLEAN','SELECT','MULTI_SELECT','URL','EMAIL','PHONE']),
  options:      z.array(z.string()).optional(),
  isRequired:   z.boolean().default(false),
  isSearchable: z.boolean().default(false),
  sortOrder:    z.number().int().default(0),
})

router.get('/custom-fields', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defs = await prisma.customFieldDefinition.findMany({
      where:   { companyId: requireCompanyId(req.user) },
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
    })
    res.json({ success: true, data: defs })
  } catch (err) { next(err) }
})

router.post('/custom-fields', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateCustomFieldSchema.parse(req.body)
    const def = await prisma.customFieldDefinition.create({
      data: { ...dto, companyId: requireCompanyId(req.user), options: dto.options ? JSON.stringify(dto.options) : undefined },
    })
    res.status(201).json({ success: true, data: def })
  } catch (err) { next(err) }
})

router.patch('/custom-fields/:id', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateCustomFieldSchema.partial().parse(req.body)
    const def = await prisma.customFieldDefinition.update({
      where: { id: req.params.id },
      data:  dto as never,
    })
    res.json({ success: true, data: def })
  } catch (err) { next(err) }
})

router.delete('/custom-fields/:id', authenticate, authorize(ROLES.OWNER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.customFieldDefinition.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})


// ── Profile (any authenticated user) ────────────────────────

router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, timezone: true, language: true,
        createdAt: true, lastLoginAt: true,
        memberships: {
          where:  { companyId: requireCompanyId(req.user) },
          select: { role: true, department: true, jobTitle: true },
        },
      },
    })
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

router.patch('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName:  z.string().min(1).max(100).optional(),
      phone:     z.string().max(50).optional().nullable(),
      avatarUrl: z.string().url().max(1000).optional().nullable(),
      timezone:  z.string().max(100).optional(),
      language:  z.string().max(10).optional(),
    })
    const dto  = schema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data:  dto,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, timezone: true, language: true,
      },
    })
    await auditService.log({
      companyId: req.user.companyId, userId: req.user.id,
      action: 'UPDATE', entityType: 'users', entityId: req.user.id,
      newValues: dto as Record<string, unknown>,
    })
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

// ── Notification preferences ──────────────────────────────────

router.get('/notifications/preferences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.companyMember.findFirst({
      where:  { userId: req.user.id, companyId: requireCompanyId(req.user) },
      select: { notificationPrefs: true },
    })
    // Return defaults if not set
    const prefs = (member?.notificationPrefs as Record<string, unknown>) ?? {
      emailOnLeadAssigned:    true,
      emailOnTicketAssigned:  true,
      emailOnTaskAssigned:    true,
      emailOnMention:         true,
      inAppLeadUpdates:       true,
      inAppTicketUpdates:     true,
      inAppTaskUpdates:       true,
      digestFrequency:        'DAILY',
    }
    res.json({ success: true, data: prefs })
  } catch (err) { next(err) }
})

router.patch('/notifications/preferences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      emailOnLeadAssigned:   z.boolean().optional(),
      emailOnTicketAssigned: z.boolean().optional(),
      emailOnTaskAssigned:   z.boolean().optional(),
      emailOnMention:        z.boolean().optional(),
      inAppLeadUpdates:      z.boolean().optional(),
      inAppTicketUpdates:    z.boolean().optional(),
      inAppTaskUpdates:      z.boolean().optional(),
      digestFrequency:       z.enum(['NONE','DAILY','WEEKLY']).optional(),
    })
    const dto = schema.parse(req.body)

    // Get existing prefs and merge
    const member = await prisma.companyMember.findFirst({
      where:  { userId: req.user.id, companyId: requireCompanyId(req.user) },
      select: { id: true, notificationPrefs: true },
    })
    const existing = (member?.notificationPrefs as Record<string, unknown>) ?? {}
    const merged   = { ...existing, ...dto }

    await prisma.companyMember.updateMany({
      where: { userId: req.user.id, companyId: requireCompanyId(req.user) },
      data:  { notificationPrefs: merged },
    })
    res.json({ success: true, data: merged })
  } catch (err) { next(err) }
})

// ── Security — active sessions ────────────────────────────────

router.get('/security/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where:   { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select:  { id: true, createdAt: true, expiresAt: true, familyId: true },
      orderBy: { createdAt: 'desc' },
      take:    10,
    })
    res.json({ success: true, data: sessions })
  } catch (err) { next(err) }
})

router.delete('/security/sessions/:sessionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { id: req.params.sessionId, userId: req.user.id },
      data:  { revokedAt: new Date() },
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.delete('/security/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Revoke all sessions except a placeholder (full logout-all)
    await prisma.refreshToken.updateMany({
      where: { userId: req.user.id },
      data:  { revokedAt: new Date() },
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── Data export ───────────────────────────────────────────────

router.get('/export/:entity', authenticate, authorize(ROLES.MANAGEMENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity } = req.params
    const companyId  = requireCompanyId(req.user)
    const allowed    = ['customers','leads','tickets','tasks','opportunities']

    if (!allowed.includes(entity)) {
      res.status(400).json({ success: false, error: { message: 'Invalid entity type' } })
      return
    }

    let rows: Record<string, unknown>[] = []

    if (entity === 'customers') {
      rows = await prisma.customer.findMany({
        where:  { companyId, deletedAt: null },
        select: {
          firstName: true, lastName: true, email: true, phone: true,
          companyName: true, industry: true, website: true, status: true,
          customerType: true, country: true, city: true, tags: true, createdAt: true,
        },
      })
    } else if (entity === 'leads') {
      rows = await prisma.lead.findMany({
        where:  { companyId, deletedAt: null },
        select: { title: true, stage: true, value: true, probability: true, source: true, createdAt: true },
      })
    } else if (entity === 'tickets') {
      rows = await prisma.ticket.findMany({
        where:  { companyId },
        select: {
          ticketNumber: true, title: true, status: true, priority: true,
          slaBreached: true, createdAt: true,
        },
      })
    } else if (entity === 'tasks') {
      rows = await prisma.task.findMany({
        where:  { companyId },
        select: { title: true, status: true, priority: true, dueDate: true, createdAt: true },
      })
    } else if (entity === 'opportunities') {
      rows = await prisma.opportunity.findMany({
        where:  { companyId, deletedAt: null },
        select: {
          title: true, stage: true, expectedRevenue: true, probability: true,
          expectedClose: true, createdAt: true,
        },
      })
    }

    // Build CSV
    if (rows.length === 0) {
      res.status(200).send('No data found')
      return
    }

    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
          return `"${String(val).replace(/"/g, '""')}"`
        }).join(',')
      ),
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${entity}-export-${new Date().toISOString().slice(0,10)}.csv"`)
    res.send(csv)
  } catch (err) { next(err) }
})

export { router as settingsRouter }
