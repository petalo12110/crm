import { BaseRepository } from '../../infrastructure/database/BaseRepository'
import { NotFoundError }  from '../../core/errors'
import type { CreateLeadInput, UpdateLeadInput, LeadFilters } from '@crm/shared'

export class LeadsRepository extends BaseRepository {

  async findMany(companyId: string, filters: LeadFilters) {
    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      ...(filters.stage      ? { stage:      filters.stage }      : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.valueMin   ? { value: { gte: filters.valueMin } } : {}),
      ...(filters.valueMax   ? { value: { lte: filters.valueMax } } : {}),
      ...(filters.createdFrom ? { createdAt: { gte: new Date(filters.createdFrom) } } : {}),
      ...(filters.createdTo   ? { createdAt: { lte: new Date(filters.createdTo) } }   : {}),
      ...(filters.search ? {
        OR: [
          { title:    { contains: filters.search, mode: 'insensitive' } },
          { source:   { contains: filters.search, mode: 'insensitive' } },
          { campaign: { contains: filters.search, mode: 'insensitive' } },
        ],
      } : {}),
    }

    const [items, total] = await this.db.$transaction([
      this.db.lead.findMany({
        where:   where as never,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        ...this.buildCursorArgs(filters.cursor, filters.limit),
      }),
      this.db.lead.count({ where: where as never }),
    ])

    const { data, meta } = this.buildPageResult(items, filters.limit)
    return { data, meta: { ...meta, total } }
  }

  async findById(id: string, companyId: string) {
    return this.db.lead.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer:     { select: { id: true, firstName: true, lastName: true, companyName: true } },
        assignee:     { select: { id: true, firstName: true, lastName: true } },
        owner:        { select: { id: true, firstName: true, lastName: true } },
        stageHistory: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })
  }

  async create(companyId: string, data: CreateLeadInput, ownerId: string) {
    return this.db.lead.create({
      data: {
        companyId,
        ownerId,
        title:         data.title,
        customerId:    data.customerId,
        source:        data.source,
        campaign:      data.campaign,
        stage:         (data.stage ?? 'NEW') as never,
        value:         data.value,
        probability:   data.probability,
        expectedClose: data.expectedClose ? new Date(data.expectedClose) : undefined,
        assignedTo:    data.assignedTo,
        notes:         data.notes,
        tags:          data.tags,
      },
    })
  }

  async update(id: string, companyId: string, data: UpdateLeadInput) {
    const updateData: Record<string, unknown> = {}
    if (data.title         !== undefined) updateData.title         = data.title
    if (data.source        !== undefined) updateData.source        = data.source
    if (data.campaign      !== undefined) updateData.campaign      = data.campaign
    if (data.value         !== undefined) updateData.value         = data.value
    if (data.probability   !== undefined) updateData.probability   = data.probability
    if (data.assignedTo    !== undefined) updateData.assignedTo    = data.assignedTo
    if (data.notes         !== undefined) updateData.notes         = data.notes
    if (data.tags          !== undefined) updateData.tags          = data.tags
    if (data.customerId    !== undefined) updateData.customerId    = data.customerId
    if (data.expectedClose !== undefined) {
      updateData.expectedClose = data.expectedClose ? new Date(data.expectedClose) : null
    }
    await this.assertBelongsToCompany(id, companyId)
    return this.db.lead.update({ where: { id }, data: updateData as never })
  }

  async updateStage(id: string, companyId: string, stage: string, changedBy: string, note?: string) {
    await this.assertBelongsToCompany(id, companyId)
    const [lead] = await this.db.$transaction([
      this.db.lead.update({ where: { id }, data: { stage: stage as never } }),
      this.db.leadStageHistory.create({
        data: { leadId: id, toStage: stage as never, changedBy, note },
      }),
    ])
    return lead
  }

  async softDelete(id: string, companyId: string) {
    await this.assertBelongsToCompany(id, companyId)
    return this.db.lead.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  /** Tenant guard — see CustomersRepository.assertBelongsToCompany for rationale. */
  private async assertBelongsToCompany(id: string, companyId: string): Promise<void> {
    const match = await this.db.lead.findFirst({
      where:  { id, companyId },
      select: { id: true },
    })
    if (!match) throw new NotFoundError('Lead not found')
  }

  async getPipelineByStage(companyId: string) {
    return this.db.lead.groupBy({
      by:    ['stage'],
      where: { companyId, deletedAt: null },
      _count:{ stage: true },
      _sum:  { value: true },
    })
  }
}
