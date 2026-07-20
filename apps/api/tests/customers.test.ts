import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CustomersService } from '../src/modules/customers/customers.service'
import { NotFoundError }    from '../src/core/errors/index'
import { ForbiddenError }   from '../src/core/errors/index'

// ── Mocks ──────────────────────────────────────────────────

const mockRepo = {
  findMany:    vi.fn(),
  findById:    vi.fn(),
  create:      vi.fn(),
  update:      vi.fn(),
  softDelete:  vi.fn(),
  restore:     vi.fn(),
  bulkAssign:  vi.fn(),
  bulkTag:     vi.fn(),
}

const mockAudit         = { log: vi.fn() }
const mockTimeline      = { addEntry: vi.fn() }
const mockNotifications = { create: vi.fn() }

const managerUser  = { id: 'u1', companyId: 'c1', role: 'MANAGER',   email: 'mgr@x.com',   firstName: 'Mgr',  lastName: 'One',  avatarUrl: null }
const salesRepUser = { id: 'u2', companyId: 'c1', role: 'SALES_REP', email: 'rep@x.com',   firstName: 'Rep',  lastName: 'Two',  avatarUrl: null }
const ownerUser    = { id: 'u3', companyId: 'c1', role: 'COMPANY_OWNER', email: 'o@x.com', firstName: 'Own',  lastName: 'Thr',  avatarUrl: null }

const makeCustomer = (overrides = {}) => ({
  id:          'cust-1',
  companyId:   'c1',
  firstName:   'John',
  lastName:    'Banda',
  email:       'john@banda.com',
  assignedTo:  'u2',
  deletedAt:   null,
  createdAt:   new Date(),
  updatedAt:   new Date(),
  ...overrides,
})

describe('CustomersService', () => {
  let svc: CustomersService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new CustomersService(
      mockRepo as never,
      mockAudit as never,
      mockTimeline as never,
      mockNotifications as never,
    )
    mockAudit.log.mockResolvedValue(undefined)
    mockTimeline.addEntry.mockResolvedValue(undefined)
  })

  // ── getById ──────────────────────────────────────────────

  describe('getById()', () => {
    it('returns the customer when found', async () => {
      const customer = makeCustomer()
      mockRepo.findById.mockResolvedValue(customer)
      await expect(svc.getById(managerUser, 'cust-1')).resolves.toEqual(customer)
      expect(mockRepo.findById).toHaveBeenCalledWith('cust-1', 'c1')
    })

    it('throws NotFoundError when customer does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(svc.getById(managerUser, 'missing')).rejects.toThrow(NotFoundError)
    })
  })

  // ── create ───────────────────────────────────────────────

  describe('create()', () => {
    it('creates customer, logs audit, and adds timeline entry', async () => {
      const dto      = { firstName: 'Jane', email: 'jane@x.com', status: 'ACTIVE' as const, customerType: 'INDIVIDUAL' as const, tags: [], customFields: {} }
      const created  = makeCustomer({ id: 'new-cust', firstName: 'Jane' })
      mockRepo.create.mockResolvedValue(created)

      const result = await svc.create(managerUser, dto)

      expect(result).toEqual(created)
      expect(mockRepo.create).toHaveBeenCalledWith('c1', dto, 'u1')
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'customers', entityId: 'new-cust' })
      )
      expect(mockTimeline.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'new-cust', entryType: 'SYSTEM' })
      )
    })
  })

  // ── update ───────────────────────────────────────────────

  describe('update()', () => {
    it('allows manager to update any customer', async () => {
      const existing = makeCustomer({ assignedTo: 'other-user' })
      const updated  = makeCustomer({ firstName: 'Updated' })
      mockRepo.findById.mockResolvedValue(existing)
      mockRepo.update.mockResolvedValue(updated)

      const result = await svc.update(managerUser, 'cust-1', { firstName: 'Updated' })
      expect(result).toEqual(updated)
      expect(mockRepo.update).toHaveBeenCalled()
    })

    it('allows owner to update any customer', async () => {
      mockRepo.findById.mockResolvedValue(makeCustomer({ assignedTo: 'u2' }))
      mockRepo.update.mockResolvedValue(makeCustomer())
      await expect(svc.update(ownerUser, 'cust-1', {})).resolves.toBeDefined()
    })

    it('allows sales rep to update their own assigned customer', async () => {
      mockRepo.findById.mockResolvedValue(makeCustomer({ assignedTo: 'u2' }))
      mockRepo.update.mockResolvedValue(makeCustomer())
      await expect(svc.update(salesRepUser, 'cust-1', { notes: 'updated' })).resolves.toBeDefined()
    })

    it('throws ForbiddenError when sales rep tries to update unassigned customer', async () => {
      mockRepo.findById.mockResolvedValue(makeCustomer({ assignedTo: 'different-rep' }))
      await expect(
        svc.update(salesRepUser, 'cust-1', { firstName: 'X' })
      ).rejects.toThrow(ForbiddenError)
    })

    it('writes audit log with old and new values on success', async () => {
      const existing = makeCustomer()
      mockRepo.findById.mockResolvedValue(existing)
      mockRepo.update.mockResolvedValue(existing)

      await svc.update(managerUser, 'cust-1', { firstName: 'Updated' })

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action:     'UPDATE',
          entityType: 'customers',
          entityId:   'cust-1',
          oldValues:  expect.objectContaining({ firstName: 'John' }),
          newValues:  expect.objectContaining({ firstName: 'Updated' }),
        })
      )
    })
  })

  // ── softDelete ───────────────────────────────────────────

  describe('softDelete()', () => {
    it('soft-deletes and writes audit log', async () => {
      mockRepo.findById.mockResolvedValue(makeCustomer())
      mockRepo.softDelete.mockResolvedValue(undefined)

      await svc.softDelete(managerUser, 'cust-1')

      expect(mockRepo.softDelete).toHaveBeenCalledWith('cust-1', 'c1')
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entityId: 'cust-1' })
      )
    })

    it('throws NotFoundError if customer does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(svc.softDelete(managerUser, 'missing')).rejects.toThrow(NotFoundError)
      expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })
  })

  // ── list ─────────────────────────────────────────────────

  describe('list()', () => {
    it('calls repository with user companyId and filters', async () => {
      const expected = { data: [], meta: { cursor: null, hasMore: false, limit: 25, total: 0 } }
      mockRepo.findMany.mockResolvedValue(expected)

      const filters = { status: 'ACTIVE' as const, limit: 25 }
      const result  = await svc.list(managerUser, filters as never)

      expect(result).toEqual(expected)
      expect(mockRepo.findMany).toHaveBeenCalledWith('c1', filters)
    })
  })

  // ── bulkAssign ───────────────────────────────────────────

  describe('bulkAssign()', () => {
    it('assigns multiple customers and writes audit log', async () => {
      mockRepo.bulkAssign.mockResolvedValue({ count: 3 })

      await svc.bulkAssign(managerUser, ['id-1','id-2','id-3'], 'new-rep')

      expect(mockRepo.bulkAssign).toHaveBeenCalledWith(['id-1','id-2','id-3'], 'c1', 'new-rep')
      expect(mockAudit.log).toHaveBeenCalled()
    })
  })
})
