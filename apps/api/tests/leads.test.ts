import './helpers/prismaMock'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeadsService }      from '../src/modules/leads/leads.service'
import { NotFoundError }     from '../src/core/errors/index'
import { ForbiddenError }    from '../src/core/errors/index'
import { BusinessRuleError } from '../src/core/errors/index'

// ── Mock prisma used in convertToCustomer ──────────────────
vi.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    customer: { create: vi.fn(async () => ({ id: 'new-cust' })) },
  },
}))

const mockRepo = {
  findMany:          vi.fn(),
  findById:          vi.fn(),
  create:            vi.fn(),
  update:            vi.fn(),
  updateStage:       vi.fn(),
  softDelete:        vi.fn(),
  getPipelineByStage:vi.fn(),
}

const mockAudit         = { log: vi.fn() }
const mockTimeline      = { addEntry: vi.fn() }
const mockNotifications = { create: vi.fn() }

const managerUser  = { id: 'u1', companyId: 'c1', role: 'MANAGER', email: 'm@x.com', firstName: 'M', lastName: 'M', avatarUrl: null }
const salesRepUser = { id: 'u2', companyId: 'c1', role: 'SALES_REP', email: 'r@x.com', firstName: 'R', lastName: 'R', avatarUrl: null }

const makeLead = (overrides = {}) => ({
  id:          'lead-1',
  companyId:   'c1',
  title:       'Test Lead',
  stage:       'NEW',
  assignedTo:  'u2',
  customerId:  'cust-1',
  deletedAt:   null,
  createdAt:   new Date(),
  updatedAt:   new Date(),
  stageHistory:[],
  ...overrides,
})

describe('LeadsService', () => {
  let svc: LeadsService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new LeadsService(mockRepo as never, mockAudit as never, mockTimeline as never, mockNotifications as never)
    mockAudit.log.mockResolvedValue(undefined)
    mockTimeline.addEntry.mockResolvedValue(undefined)
    mockNotifications.create.mockResolvedValue(undefined)
  })

  // ── Stage transitions ────────────────────────────────────

  describe('transitionStage()', () => {
    it('allows valid transition NEW → CONTACTED', async () => {
      const lead = makeLead({ stage: 'NEW' })
      mockRepo.findById.mockResolvedValue(lead)
      mockRepo.updateStage.mockResolvedValue({ ...lead, stage: 'CONTACTED' })

      const result = await svc.transitionStage(managerUser, 'lead-1', { stage: 'CONTACTED' })
      expect(result.stage).toBe('CONTACTED')
      expect(mockRepo.updateStage).toHaveBeenCalledWith('lead-1', 'c1', 'CONTACTED', 'u1', undefined)
    })

    it('allows valid transition QUALIFIED → PROPOSAL_SENT', async () => {
      const lead = makeLead({ stage: 'QUALIFIED' })
      mockRepo.findById.mockResolvedValue(lead)
      mockRepo.updateStage.mockResolvedValue({ ...lead, stage: 'PROPOSAL_SENT' })

      await expect(
        svc.transitionStage(managerUser, 'lead-1', { stage: 'PROPOSAL_SENT' })
      ).resolves.toBeDefined()
    })

    it('rejects invalid transition ARCHIVED → QUALIFIED', async () => {
      mockRepo.findById.mockResolvedValue(makeLead({ stage: 'ARCHIVED' }))

      await expect(
        svc.transitionStage(managerUser, 'lead-1', { stage: 'QUALIFIED' })
      ).rejects.toThrow(BusinessRuleError)

      expect(mockRepo.updateStage).not.toHaveBeenCalled()
    })

    it('rejects invalid transition WON → NEW (not allowed)', async () => {
      mockRepo.findById.mockResolvedValue(makeLead({ stage: 'WON' }))
      await expect(
        svc.transitionStage(managerUser, 'lead-1', { stage: 'NEW' })
      ).rejects.toThrow(BusinessRuleError)
    })

    it('notifies assigned employee when transitioned by different user', async () => {
      const lead = makeLead({ stage: 'NEW', assignedTo: 'other-user' })
      mockRepo.findById.mockResolvedValue(lead)
      mockRepo.updateStage.mockResolvedValue({ ...lead, stage: 'CONTACTED' })

      await svc.transitionStage(managerUser, 'lead-1', { stage: 'CONTACTED' })

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'other-user', type: 'LEAD_STAGE_CHANGED' })
      )
    })

    it('does not notify when actor is the assignee', async () => {
      const lead = makeLead({ stage: 'NEW', assignedTo: 'u1' }) // same as managerUser.id
      mockRepo.findById.mockResolvedValue(lead)
      mockRepo.updateStage.mockResolvedValue({ ...lead, stage: 'CONTACTED' })

      await svc.transitionStage(managerUser, 'lead-1', { stage: 'CONTACTED' })
      expect(mockNotifications.create).not.toHaveBeenCalled()
    })

    it('adds timeline entry when lead has a customer', async () => {
      const lead = makeLead({ stage: 'NEW', customerId: 'cust-1' })
      mockRepo.findById.mockResolvedValue(lead)
      mockRepo.updateStage.mockResolvedValue({ ...lead, stage: 'CONTACTED' })

      await svc.transitionStage(managerUser, 'lead-1', { stage: 'CONTACTED' })

      expect(mockTimeline.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cust-1', entryType: 'STAGE_CHANGE' })
      )
    })
  })

  // ── Convert to customer ──────────────────────────────────

  describe('convertToCustomer()', () => {
    it('throws BusinessRuleError when lead is not WON', async () => {
      mockRepo.findById.mockResolvedValue(makeLead({ stage: 'QUALIFIED' }))
      await expect(
        svc.convertToCustomer(managerUser, 'lead-1', { createCustomer: true })
      ).rejects.toThrow(BusinessRuleError)
    })

    it('skips creating customer when lead already has one', async () => {
      mockRepo.findById.mockResolvedValue(makeLead({ stage: 'WON', customerId: 'existing-cust' }))
      mockRepo.update.mockResolvedValue({})
      const { prisma } = await import('../src/infrastructure/database/prisma')

      const result = await svc.convertToCustomer(managerUser, 'lead-1', { createCustomer: false })

      expect(result.customerId).toBe('existing-cust')
      expect(prisma.customer.create).not.toHaveBeenCalled()
    })
  })

  // ── RBAC ─────────────────────────────────────────────────

  describe('update()', () => {
    it('allows sales rep to update their own lead', async () => {
      const lead = makeLead({ assignedTo: 'u2' })
      mockRepo.findById.mockResolvedValue(lead)
      mockRepo.update.mockResolvedValue(lead)
      await expect(svc.update(salesRepUser, 'lead-1', { notes: 'x' })).resolves.toBeDefined()
    })

    it('throws ForbiddenError when sales rep edits unassigned lead', async () => {
      mockRepo.findById.mockResolvedValue(makeLead({ assignedTo: 'other' }))
      await expect(svc.update(salesRepUser, 'lead-1', {})).rejects.toThrow(ForbiddenError)
    })
  })
})
