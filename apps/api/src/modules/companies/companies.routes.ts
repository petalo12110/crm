import { Router, Request, Response, NextFunction } from 'express'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }           from '../../infrastructure/database/prisma'
import { Prisma }           from '@prisma/client'
import { generateSlug, generateSecureToken, hashPassword } from '../../core/utils/index'
import { AuthService }      from '../auth/auth.service'
import { AuthRepository }   from '../auth/auth.repository'
import { auditService }     from '../audit/audit.service'
import { NotFoundError }    from '../../core/errors'
import { z }                from 'zod'
import { optionalEmail, optionalUrl } from '@crm/shared'

const router: Router = Router()
const authService = new AuthService(new AuthRepository(), auditService)

const PLAN_LIMITS: Record<string, { maxUsers: number; maxCustomers: number; maxStorageGb: number }> = {
  FREE:         { maxUsers: 5,   maxCustomers: 500,    maxStorageGb: 5    },
  STARTER:      { maxUsers: 15,  maxCustomers: 2500,   maxStorageGb: 20   },
  PROFESSIONAL: { maxUsers: 50,  maxCustomers: 10000,  maxStorageGb: 100  },
  ENTERPRISE:   { maxUsers: 500, maxCustomers: 100000, maxStorageGb: 1000 },
}

const CreateCompanySchema = z.object({
  name:     z.string().min(1).max(255),
  email:    optionalEmail(),
  phone:    z.string().max(50).optional(),
  country:  z.string().length(2).optional(),
  timezone: z.string().max(100).default('UTC'),
  currency: z.string().length(3).default('USD'),
  planTier: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).default('FREE'),
  // A company with no owner has no possible login at all — optional here
  // only so existing callers/tests that don't pass it don't break, but the
  // Super Admin UI always sends it.
  owner: z.object({
    firstName: z.string().min(1).max(100),
    lastName:  z.string().min(1).max(100),
    email:     z.string().email(),
  }).optional(),
})

const UpdateCompanySchema = CreateCompanySchema.partial().extend({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor:  z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl:      optionalUrl({ nullable: true }),
  taxLabel:     z.string().max(50).optional().nullable(),
  taxRate:      z.coerce.number().min(0).max(100).optional(),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingHoursEnd:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  // Subscription status is Super-Admin-only — a company owner can change
  // their own company's profile/branding but shouldn't be able to
  // activate/suspend their own billing status.
  subscriptionStatus: z.enum(['ACTIVE','TRIALING','PAST_DUE','CANCELLED','SUSPENDED']).optional(),
})

// Super Admin: list all companies
router.get('/', authenticate, authorize(ROLES.SUPER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit) || 25
    const companies = await prisma.company.findMany({
      where:   { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: { _count: { select: { members: true, customers: true } }, subscription: true },
    })
    res.json({ success: true, data: companies, meta: { total: companies.length } })
  } catch (err) { next(err) }
})

// Super Admin: create company
router.post('/', authenticate, authorize(ROLES.SUPER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto  = CreateCompanySchema.parse(req.body)
    const slug = generateSlug(dto.name)

    // Company + owner user + membership are created in a single transaction
    // so we can never end up with an orphaned, ownerless company if the
    // owner half fails partway (e.g. a duplicate email) — previously
    // company creation didn't create any user at all, so a "created"
    // company had no possible login until someone separately (and
    // manually) invited an owner into it via a role the invite endpoint
    // didn't even support yet.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const limits = PLAN_LIMITS[dto.planTier]
      const company = await tx.company.create({
        data: {
          name: dto.name, email: dto.email, phone: dto.phone,
          country: dto.country, timezone: dto.timezone, currency: dto.currency,
          slug,
          subscription: {
            create: {
              planTier: dto.planTier,
              // FREE is a permanent tier, not a trial of anything — paid
              // tiers start in TRIALING so billing/upgrade flows (whenever
              // built) have a real trial-conversion point to hook into.
              status: dto.planTier === 'FREE' ? 'ACTIVE' : 'TRIALING',
              ...limits,
            },
          },
        },
      })

      if (!dto.owner) return { company, ownerUser: null }

      let ownerUser = await tx.user.findFirst({ where: { email: dto.owner.email.toLowerCase(), deletedAt: null } })
      const isNewUser = !ownerUser
      if (!ownerUser) {
        // See companies members-invite endpoint below for why this password
        // is intentionally random and never revealed — the owner sets their
        // real one via the welcome email link.
        ownerUser = await tx.user.create({
          data: {
            email:        dto.owner.email.toLowerCase(),
            firstName:    dto.owner.firstName,
            lastName:     dto.owner.lastName,
            passwordHash: await hashPassword(generateSecureToken(32)),
          },
        })
      }

      await tx.companyMember.create({
        data: { companyId: company.id, userId: ownerUser.id, role: 'COMPANY_OWNER' },
      })

      return { company, ownerUser, isNewUser }
    })

    // Email is real network I/O — send it after the transaction has
    // committed, not inside it.
    if (result.ownerUser && result.isNewUser) {
      await authService.sendWelcomeEmail(
        { id: result.ownerUser.id, email: result.ownerUser.email, firstName: result.ownerUser.firstName },
        result.company.name,
        result.company.id
      )
    }

    res.status(201).json({ success: true, data: result.company })
  } catch (err) { next(err) }
})

// Get own company (or any company for Super Admin)
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Allow access only if it's the user's own company or user is Super Admin
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    const company = await prisma.company.findFirst({
      where:   { id: req.params.id, deletedAt: null },
      include: { subscription: true },
    })
    if (!company) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } })
    res.json({ success: true, data: company })
  } catch (err) { next(err) }
})

// Update company (Owner or Super Admin)
router.patch('/:id', authenticate, authorize([...ROLES.OWNER_ONLY, 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }
    const dto = UpdateCompanySchema.parse(req.body)

    // planTier/subscriptionStatus/owner don't live on the Company model
    // itself — they were previously passed straight into
    // prisma.company.update() as-is, which either silently did nothing
    // (Prisma ignores unknown keys in some configs) or threw, meaning
    // there was actually no working way to change a company's plan or
    // activate a TRIALING subscription anywhere in the app. Split them out
    // and route planTier/subscriptionStatus to the nested Subscription
    // record instead.
    const { planTier, subscriptionStatus, owner: _owner, ...companyFields } = dto
    const limits = planTier ? PLAN_LIMITS[planTier] : undefined

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...companyFields,
        ...((planTier || subscriptionStatus) ? {
          subscription: {
            update: {
              ...(planTier ? { planTier, ...limits } : {}),
              ...(subscriptionStatus ? { status: subscriptionStatus } : {}),
            },
          },
        } : {}),
      },
      include: { subscription: true },
    })
    res.json({ success: true, data: company })
  } catch (err) { next(err) }
})

// Soft delete (Super Admin only)
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ONLY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.company.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } })
    res.status(204).send()
  } catch (err) { next(err) }
})

// Company stats
router.get('/:id/stats', authenticate, authorize([...ROLES.MANAGEMENT, 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id
    const [customers, leads, employees, tickets, subscription] = await Promise.all([
      prisma.customer.count({ where: { companyId: id, deletedAt: null } }),
      prisma.lead.count({ where: { companyId: id, deletedAt: null } }),
      prisma.companyMember.count({ where: { companyId: id, isActive: true } }),
      prisma.ticket.count({ where: { companyId: id, deletedAt: null, status: { notIn: ['CLOSED','RESOLVED'] as never[] } } }),
      prisma.subscription.findUnique({ where: { companyId: id } }),
    ])
    res.json({ success: true, data: { totalCustomers: customers, totalLeads: leads, totalEmployees: employees, openTickets: tickets, subscription } })
  } catch (err) { next(err) }
})

// ── Members sub-resource ───────────────────────────────────

router.get('/:id/members', authenticate, authorize([...ROLES.MANAGEMENT, 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }
    const members = await prisma.companyMember.findMany({
      where:   { companyId: req.params.id, isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, lastLoginAt: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    res.json({ success: true, data: members, meta: { total: members.length } })
  } catch (err) { next(err) }
})

const InviteMemberSchema = z.object({
  email:      z.string().email(),
  firstName:  z.string().min(1).max(100),
  lastName:   z.string().min(1).max(100),
  role:       z.enum(['COMPANY_OWNER','MANAGER','SALES_REP','SUPPORT','EMPLOYEE']),
  department: z.string().max(100).optional(),
  jobTitle:   z.string().max(100).optional(),
})

router.post('/:id/members', authenticate, authorize([...ROLES.OWNER_ONLY, 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    const dto = InviteMemberSchema.parse(req.body)

    const company = await prisma.company.findFirst({
      where:  { id: req.params.id, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!company) throw new NotFoundError('Company not found')

    // Find or create user
    let user = await prisma.user.findFirst({ where: { email: dto.email.toLowerCase(), deletedAt: null } })
    const isNewUser = !user

    if (!user) {
      // Generate a cryptographically random password the user (and everyone
      // else) will never see or need — it only exists to satisfy the
      // non-nullable passwordHash column. The user sets their real password
      // via the welcome email link below, using the same token flow as
      // forgotPassword. Previously this used Math.random() and threw the
      // password away without emailing anything, so new employees could
      // never log in.
      const unusablePassword = generateSecureToken(32)
      user = await prisma.user.create({
        data: {
          email:        dto.email.toLowerCase(),
          firstName:    dto.firstName,
          lastName:     dto.lastName,
          passwordHash: await hashPassword(unusablePassword),
        },
      })
    }

    // Create membership
    const member = await prisma.companyMember.upsert({
      where:  { companyId_userId: { companyId: req.params.id, userId: user.id } },
      update: { role: dto.role as never, isActive: true, department: dto.department, jobTitle: dto.jobTitle },
      create: {
        companyId:  req.params.id,
        userId:     user.id,
        role:       dto.role as never,
        department: dto.department,
        jobTitle:   dto.jobTitle,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    })

    // Only brand-new accounts need a "set your password" email — an
    // existing user being added to an additional company keeps their
    // existing password untouched, so there's nothing for them to set.
    if (isNewUser) {
      await authService.sendWelcomeEmail(
        { id: user.id, email: user.email, firstName: user.firstName },
        company.name,
        company.id
      )
    }

    res.status(201).json({ success: true, data: member })
  } catch (err) { next(err) }
})

router.patch('/:id/members/:memberId', authenticate, authorize([...ROLES.OWNER_ONLY, 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }
    const existing = await prisma.companyMember.findFirst({
      where:  { id: req.params.memberId, companyId: req.params.id },
      select: { id: true },
    })
    if (!existing) throw new NotFoundError('Employee not found')

    const UpdateMemberSchema = z.object({
      role:       z.enum(['COMPANY_OWNER','MANAGER','SALES_REP','SUPPORT','EMPLOYEE']).optional(),
      department: z.string().max(100).optional(),
      jobTitle:   z.string().max(100).optional(),
    })
    const dto    = UpdateMemberSchema.parse(req.body)
    const member = await prisma.companyMember.update({
      where: { id: req.params.memberId },
      data:  dto as never,
    })
    res.json({ success: true, data: member })
  } catch (err) { next(err) }
})

router.delete('/:id/members/:memberId', authenticate, authorize([...ROLES.OWNER_ONLY, 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }
    const existing = await prisma.companyMember.findFirst({
      where:  { id: req.params.memberId, companyId: req.params.id },
      select: { id: true },
    })
    if (!existing) throw new NotFoundError('Employee not found')

    await prisma.companyMember.update({
      where: { id: req.params.memberId },
      data:  { isActive: false },
    })
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as companiesRouter }
