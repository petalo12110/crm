import { BaseRepository }  from '../../infrastructure/database/BaseRepository'
import { NotFoundError }   from '../../core/errors'
import type { CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from '@crm/shared'

export class CustomersRepository extends BaseRepository {

  async findMany(companyId: string, filters: CustomerFilters) {
    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      ...(filters.status       ? { status:       filters.status }       : {}),
      ...(filters.customerType ? { customerType: filters.customerType } : {}),
      ...(filters.assignedTo   ? { assignedTo:   filters.assignedTo }   : {}),
      ...(filters.country      ? { country:       filters.country }      : {}),
      ...(filters.tags?.length ? { tags: { hasEvery: filters.tags } }   : {}),
      ...(filters.createdFrom  ? { createdAt: { gte: new Date(filters.createdFrom) } } : {}),
      ...(filters.createdTo    ? { createdAt: { lte: new Date(filters.createdTo) } }   : {}),
      ...(filters.search ? {
        OR: [
          { firstName:   { contains: filters.search, mode: 'insensitive' } },
          { lastName:    { contains: filters.search, mode: 'insensitive' } },
          { email:       { contains: filters.search, mode: 'insensitive' } },
          { companyName: { contains: filters.search, mode: 'insensitive' } },
          { phone:       { contains: filters.search } },
        ],
      } : {}),
    }

    const [items, total] = await this.db.$transaction([
      this.db.customer.findMany({
        where: where as never,
        orderBy: this.buildOrderBy(filters.sort),
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          owner:    { select: { id: true, firstName: true, lastName: true } },
          _count:   { select: { leads: true, tickets: true } },
        },
        ...this.buildCursorArgs(filters.cursor, filters.limit),
      }),
      this.db.customer.count({ where: where as never }),
    ])

    const { data, meta } = this.buildPageResult(items, filters.limit)
    return { data, meta: { ...meta, total } }
  }

  async findById(id: string, companyId: string) {
    return this.db.customer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        owner:    { select: { id: true, firstName: true, lastName: true } },
        _count:   { select: { leads: true, tickets: true } },
      },
    })
  }

  async create(companyId: string, data: CreateCustomerInput, ownerId: string) {
    return this.db.customer.create({
      data: {
        companyId,
        ownerId,
        firstName:    data.firstName,
        lastName:     data.lastName,
        email:        data.email,
        phone:        data.phone,
        phoneAlt:     data.phoneAlt,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city:         data.city,
        province:     data.province,
        postalCode:   data.postalCode,
        country:      data.country,
        companyName:  data.companyName,
        industry:     data.industry,
        website:      data.website,
        status:       data.status,
        customerType: data.customerType,
        tags:         data.tags,
        assignedTo:   data.assignedTo,
        notes:        data.notes,
      },
    })
  }

  async update(id: string, companyId: string, data: UpdateCustomerInput) {
    const updateData: Record<string, unknown> = {}
    const fields = ['firstName','lastName','email','phone','phoneAlt','addressLine1',
      'addressLine2','city','province','postalCode','country','companyName','industry',
      'website','status','customerType','tags','assignedTo','notes'] as const
    for (const field of fields) {
      if (data[field] !== undefined) updateData[field] = data[field]
    }
    await this.assertBelongsToCompany(id, companyId)
    return this.db.customer.update({ where: { id }, data: updateData as never })
  }

  async softDelete(id: string, companyId: string) {
    await this.assertBelongsToCompany(id, companyId)
    return this.db.customer.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async restore(id: string, companyId: string) {
    await this.assertBelongsToCompany(id, companyId)
    return this.db.customer.update({ where: { id }, data: { deletedAt: null } })
  }

  /**
   * Tenant guard used by every mutating method above. `update()` on a
   * unique `id` can't take a compound `where`, so we verify ownership
   * with an explicit lookup first rather than trusting the caller to
   * have already checked it (that assumption is what caused the
   * cross-tenant restore bug — see CustomersService.restore).
   */
  private async assertBelongsToCompany(id: string, companyId: string): Promise<void> {
    const match = await this.db.customer.findFirst({
      where:  { id, companyId },
      select: { id: true },
    })
    if (!match) throw new NotFoundError('Customer not found')
  }

  async bulkAssign(ids: string[], companyId: string, assignedTo: string) {
    return this.db.customer.updateMany({
      where: { id: { in: ids }, companyId, deletedAt: null },
      data:  { assignedTo },
    })
  }

  async bulkTag(ids: string[], companyId: string, tags: string[]) {
    const customers = await this.db.customer.findMany({
      where:  { id: { in: ids }, companyId, deletedAt: null },
      select: { id: true, tags: true },
    })
    await Promise.all(
      customers.map((c: { id: string; tags: string[] }) =>
        this.db.customer.update({
          where: { id: c.id },
          data:  { tags: [...new Set([...c.tags, ...tags])] },
        })
      )
    )
  }

  private buildOrderBy(sort?: string): Record<string, 'asc' | 'desc'> {
    if (!sort) return { createdAt: 'desc' }
    const desc  = sort.startsWith('-')
    const field = desc ? sort.slice(1) : sort
    const validFields = ['firstName','lastName','email','companyName','status','createdAt','updatedAt']
    if (!validFields.includes(field)) return { createdAt: 'desc' }
    return { [field]: desc ? 'desc' : 'asc' }
  }
}
