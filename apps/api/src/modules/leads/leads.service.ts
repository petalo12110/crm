import { LeadsRepository }    from './leads.repository'
import { AuditService }       from '../audit/audit.service'
import { TimelineService }    from '../communications/timeline.service'
import { NotificationsService } from '../notifications/notifications.service'
import { NotFoundError, ForbiddenError, BusinessRuleError } from '../../core/errors/index'
import { LEAD_STAGE_TRANSITIONS } from '@crm/shared'
import { requireCompanyId }   from '../../core/utils/index'
import type { AuthUser }      from '../../core/types/index'
import type {
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilters,
  TransitionLeadStageInput,
  ConvertLeadInput,
  LeadStage,
} from '@crm/shared'
import { prisma } from '../../infrastructure/database/prisma'

export class LeadsService {
  constructor(
    private readonly repo:          LeadsRepository,
    private readonly audit:         AuditService,
    private readonly timeline:      TimelineService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, filters: LeadFilters) {
    return this.repo.findMany(requireCompanyId(user), filters)
  }

  async getById(user: AuthUser, leadId: string) {
    const lead = await this.repo.findById(leadId, requireCompanyId(user))
    if (!lead) throw new NotFoundError('Lead not found')
    return lead
  }

  async create(user: AuthUser, dto: CreateLeadInput) {
    const companyId = requireCompanyId(user)
    const lead = await this.repo.create(companyId, dto, user.id)

    await Promise.all([
      this.audit.log({
        companyId,
        userId:     user.id,
        action:     'CREATE',
        entityType: 'leads',
        entityId:   lead.id,
        newValues:  dto as Record<string, unknown>,
      }),
      // If linked to a customer, add to their timeline
      lead.customerId && this.timeline.addEntry({
        companyId,
        customerId:    lead.customerId,
        entryType:     'STAGE_CHANGE',
        direction:     'INTERNAL',
        subject:       `New lead created: ${lead.title}`,
        userId:        user.id,
        refEntityType: 'LEAD',
        refEntityId:   lead.id,
      }),
    ])

    return lead
  }

  async update(user: AuthUser, leadId: string, dto: UpdateLeadInput) {
    const companyId = requireCompanyId(user)
    const existing = await this.getById(user, leadId)

    if (user.role === 'SALES_REP' && existing.assignedTo !== user.id) {
      throw new ForbiddenError('You can only edit leads assigned to you')
    }

    const updated = await this.repo.update(leadId, companyId, dto)

    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'UPDATE',
      entityType: 'leads',
      entityId:   leadId,
      oldValues:  existing as Record<string, unknown>,
      newValues:  dto as Record<string, unknown>,
    })

    return updated
  }

  async transitionStage(user: AuthUser, leadId: string, dto: TransitionLeadStageInput) {
    const companyId = requireCompanyId(user)
    const lead = await this.getById(user, leadId)

    // Enforce valid stage transitions
    const allowedNext = LEAD_STAGE_TRANSITIONS[lead.stage as LeadStage] ?? []
    if (!allowedNext.includes(dto.stage as LeadStage)) {
      throw new BusinessRuleError(
        `Cannot transition from ${lead.stage} to ${dto.stage}.`,
        [{ field: 'stage', message: `Allowed next stages: ${allowedNext.join(', ')}` }]
      )
    }

    const updated = await this.repo.updateStage(leadId, companyId, dto.stage, user.id, dto.note ?? undefined)

    // Update customer timeline
    if (lead.customerId) {
      await this.timeline.addEntry({
        companyId,
        customerId:    lead.customerId,
        entryType:     'STAGE_CHANGE',
        direction:     'INTERNAL',
        subject:       `Lead stage: ${lead.stage} → ${dto.stage}`,
        body:          dto.note ?? undefined,
        userId:        user.id,
        refEntityType: 'LEAD',
        refEntityId:   leadId,
      })
    }

    // Notify assigned employee of stage change (if different from actor)
    if (lead.assignedTo && lead.assignedTo !== user.id) {
      await this.notifications.create({
        companyId,
        userId:     lead.assignedTo,
        type:       'LEAD_STAGE_CHANGED',
        title:      `Lead "${lead.title}" moved to ${dto.stage}`,
        entityType: 'LEAD',
        entityId:   leadId,
        url:        `/leads/${leadId}`,
      })
    }

    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'UPDATE',
      entityType: 'leads',
      entityId:   leadId,
      oldValues:  { stage: lead.stage },
      newValues:  { stage: dto.stage },
    })

    return updated
  }

  async convertToCustomer(user: AuthUser, leadId: string, dto: ConvertLeadInput) {
    const companyId = requireCompanyId(user)
    const lead = await this.getById(user, leadId)
    if (lead.stage !== 'WON') {
      throw new BusinessRuleError('Only leads in WON stage can be converted to customers')
    }

    let customerId = lead.customerId

    if (dto.createCustomer && !customerId) {
      const customer = await prisma.customer.create({
        data: {
          companyId,
          ownerId:     user.id,
          email:       dto.customerData?.email,
          companyName: dto.customerData?.companyName,
          status:      'ACTIVE',
        },
      })
      customerId = customer.id

      // Link lead to the new customer
      await this.repo.update(leadId, companyId, { customerId } as UpdateLeadInput)
    }

    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'UPDATE',
      entityType: 'leads',
      entityId:   leadId,
      newValues:  { convertedToCustomer: customerId },
    })

    return { leadId, customerId }
  }

  async softDelete(user: AuthUser, leadId: string) {
    const companyId = requireCompanyId(user)
    await this.getById(user, leadId)
    await this.repo.softDelete(leadId, companyId)
    await this.audit.log({
      companyId,
      userId:     user.id,
      action:     'DELETE',
      entityType: 'leads',
      entityId:   leadId,
    })
  }

  async getPipeline(user: AuthUser) {
    return this.repo.getPipelineByStage(requireCompanyId(user))
  }
}
