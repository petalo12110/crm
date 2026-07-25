import { CustomersRepository } from './customers.repository'
import { AuditService }        from '../audit/audit.service'
import { TimelineService }     from '../communications/timeline.service'
import { NotificationsService } from '../notifications/notifications.service'
import { NotFoundError }       from '../../core/errors/index'
import { ForbiddenError }      from '../../core/errors/index'
import { ValidationError }     from '../../core/errors/index'
import { queueService }        from '../../infrastructure/queue/QueueService'
import { prisma }              from '../../infrastructure/database/prisma'
import { requireCompanyId }    from '../../core/utils/index'
import type { AuthUser }       from '../../core/types/index'
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilters,
} from '@crm/shared'

export class CustomersService {
  constructor(
    private readonly repo:          CustomersRepository,
    private readonly audit:         AuditService,
    private readonly timeline:      TimelineService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, filters: CustomerFilters) {
    return this.repo.findMany(requireCompanyId(user), filters)
  }

  async getById(user: AuthUser, customerId: string) {
    const customer = await this.repo.findById(customerId, requireCompanyId(user))
    if (!customer) throw new NotFoundError('Customer not found')
    return customer
  }

  /**
   * Sends a real email to the customer and logs it to their timeline —
   * closes the gap where the timeline could only ever record that a call
   * or email happened after the fact, with no way to actually send one
   * from inside the app. Reuses the same queue -> worker -> SMTP pipeline
   * built for invites/password resets. Uses this company's own SMTP
   * settings (Settings > Email) if configured, falling back to the
   * platform default (Super Admin > Email) otherwise.
   */
  async sendEmail(user: AuthUser, customerId: string, dto: { subject: string; body: string }) {
    const companyId = requireCompanyId(user)
    const customer = await this.getById(user, customerId)
    if (!customer.email) {
      throw new ValidationError('This customer has no email address on file')
    }

    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { name: true },
    })

    await queueService.sendEmail({
      to:      customer.email,
      subject: dto.subject,
      template: 'customer-email',
      companyId,
      context: {
        // Line breaks need to survive into HTML — the template renders
        // this pre-escaped/converted rather than trusting raw agent input
        // as HTML (see EmailProvider's renderTemplate — Handlebars
        // escapes {{body}} by default, which is exactly what we want
        // here since this is plain text from a form, not authored HTML).
        body:        dto.body,
        companyName: company?.name ?? 'Our team',
        senderName:  `${user.firstName} ${user.lastName}`.trim(),
      },
    })

    await Promise.all([
      this.timeline.addEntry({
        companyId, customerId,
        entryType: 'EMAIL', direction: 'OUTBOUND',
        subject:   dto.subject, body: dto.body,
        userId:    user.id,
      }),
      this.audit.log({
        companyId, userId: user.id,
        action: 'CREATE', entityType: 'customer_email', entityId: customerId,
        newValues: { subject: dto.subject },
      }),
    ])

    return { sent: true }
  }

  async create(user: AuthUser, dto: CreateCustomerInput) {
    const companyId = requireCompanyId(user)
    const customer = await this.repo.create(companyId, dto, user.id)

    await Promise.all([
      this.audit.log({
        companyId,
        userId:     user.id,
        action:     'CREATE',
        entityType: 'customers',
        entityId:   customer.id,
        newValues:  dto as Record<string, unknown>,
      }),
      this.timeline.addEntry({
        companyId,
        customerId: customer.id,
        entryType:  'SYSTEM',
        direction:  'INTERNAL',
        subject:    'Customer record created',
        userId:     user.id,
      }),
    ])

    return customer
  }

  async update(user: AuthUser, customerId: string, dto: UpdateCustomerInput) {
    const companyId = requireCompanyId(user)
    const existing = await this.getById(user, customerId)

    // Sales reps may only edit their assigned customers
    if (user.role === 'SALES_REP' && existing.assignedTo !== user.id) {
      throw new ForbiddenError('You can only edit customers assigned to you')
    }

    const updated = await this.repo.update(customerId, companyId, dto)

    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'UPDATE',
      entityType: 'customers',
      entityId:   customerId,
      oldValues:  existing as Record<string, unknown>,
      newValues:  dto as Record<string, unknown>,
    })

    return updated
  }

  async softDelete(user: AuthUser, customerId: string) {
    const companyId = requireCompanyId(user)
    await this.getById(user, customerId)
    await this.repo.softDelete(customerId, companyId)
    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'DELETE',
      entityType: 'customers',
      entityId:   customerId,
    })
  }

  async restore(user: AuthUser, customerId: string) {
    const companyId = requireCompanyId(user)
    // Note: can't use getById() here — it filters deletedAt: null, which
    // would always 404 on the very record we're trying to restore.
    // Tenant ownership is enforced inside repo.restore() instead.
    await this.repo.restore(customerId, companyId)
    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'UPDATE',
      entityType: 'customers',
      entityId:   customerId,
      newValues:  { deletedAt: null },
    })
  }

  async bulkAssign(user: AuthUser, ids: string[], assignedTo: string) {
    const companyId = requireCompanyId(user)
    await this.repo.bulkAssign(ids, companyId, assignedTo)
    await this.audit.log({
      companyId,
      userId:    user.id,
      action:    'UPDATE',
      entityType:'customers',
      newValues: { ids, assignedTo },
    })
  }

  async bulkTag(user: AuthUser, ids: string[], tags: string[]) {
    await this.repo.bulkTag(ids, requireCompanyId(user), tags)
  }
}
