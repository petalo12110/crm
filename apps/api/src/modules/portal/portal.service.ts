import { prisma }        from '../../infrastructure/database/prisma'
import { queueService }  from '../../infrastructure/queue/QueueService'
import { renderTemplate } from '../../infrastructure/email/EmailProvider'
import { generateSecureToken, hashToken, signPortalToken } from '../../core/utils'
import { NotFoundError, ForbiddenError, ValidationError } from '../../core/errors'
import { config } from '../../config/env'
import { TimelineService } from '../communications/timeline.service'
import { NotificationsService } from '../notifications/notifications.service'
import type { PortalCustomer } from '../../delivery/middleware/authenticatePortal'

const timeline      = new TimelineService()
const notifications = new NotificationsService()

export class PortalService {
  // ── Magic-link auth ──────────────────────────────────────

  async requestLoginLink(companySlug: string, email: string): Promise<void> {
    const company = await prisma.company.findFirst({ where: { slug: companySlug, deletedAt: null } })
    // Always resolve without error even if the company/customer doesn't
    // exist — same "don't reveal whether the account exists" principle
    // as forgotPassword.
    if (!company) return

    const customer = await prisma.customer.findFirst({
      where: { companyId: company.id, email: email.toLowerCase(), deletedAt: null },
    })
    if (!customer) return

    const rawToken  = generateSecureToken(32)
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 30 * 60_000) // 30 minutes — short-lived, re-requestable any time

    // Invalidate any previous unused login links for this customer first,
    // same pattern as password reset tokens.
    await prisma.customerPortalToken.updateMany({
      where: { customerId: customer.id, usedAt: null },
      data:  { usedAt: new Date() },
    })
    await prisma.customerPortalToken.create({
      data: { customerId: customer.id, tokenHash, expiresAt },
    })

    await queueService.sendEmail({
      to:      customer.email!,
      subject: `Your ${company.name} support portal login link`,
      template: 'portal-login',
      context: {
        firstName:   customer.firstName ?? 'there',
        companyName: company.name,
        loginUrl:    `${config.FRONTEND_URL}/portal/${companySlug}/verify?token=${rawToken}`,
      },
    })
  }

  async verifyLoginLink(companySlug: string, rawToken: string) {
    const company = await prisma.company.findFirst({ where: { slug: companySlug, deletedAt: null } })
    if (!company) throw new NotFoundError('Portal not found')

    const tokenHash = hashToken(rawToken)
    const stored = await prisma.customerPortalToken.findUnique({ where: { tokenHash } })

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new ForbiddenError('This login link is invalid or has expired — request a new one')
    }

    const customer = await prisma.customer.findFirst({
      where: { id: stored.customerId, companyId: company.id, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Account not found')

    await prisma.customerPortalToken.update({
      where: { id: stored.id },
      data:  { usedAt: new Date() },
    })

    const accessToken = signPortalToken({ sub: customer.id, companyId: company.id })

    return {
      accessToken,
      customer: {
        id: customer.id, firstName: customer.firstName, lastName: customer.lastName,
        email: customer.email, companyId: company.id,
      },
      company: { id: company.id, name: company.name, slug: company.slug },
    }
  }

  // ── Tickets (customer-scoped) ────────────────────────────

  async listMyTickets(customer: PortalCustomer) {
    return prisma.ticket.findMany({
      where:   { customerId: customer.id, companyId: customer.companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, ticketNumber: true, title: true, status: true, priority: true,
        createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true,
      },
    })
  }

  async getMyTicket(customer: PortalCustomer, ticketId: string) {
    const ticket = await prisma.ticket.findFirst({
      where:  { id: ticketId, customerId: customer.id, companyId: customer.companyId, deletedAt: null },
      include: {
        // Internal agent notes are never returned to the customer — this
        // filter is the whole point of the isInternal flag existing.
        replies: {
          where:   { isInternal: false, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    })
    if (!ticket) throw new NotFoundError('Ticket not found')
    return ticket
  }

  async createTicket(customer: PortalCustomer, dto: { title: string; description?: string; priority?: string }) {
    const count = await prisma.ticket.count({ where: { companyId: customer.companyId } })
    const ticket = await prisma.ticket.create({
      data: {
        companyId:    customer.companyId,
        customerId:   customer.id,
        ticketNumber: `TKT-${String(count + 1).padStart(6, '0')}`,
        title:        dto.title,
        description:  dto.description,
        priority:     (dto.priority ?? 'MEDIUM') as never,
      },
    })

    await timeline.addEntry({
      companyId: customer.companyId, customerId: customer.id,
      entryType: 'TICKET', direction: 'INBOUND',
      subject:   `Customer opened ticket: ${ticket.title}`,
      refEntityType: 'TICKET', refEntityId: ticket.id,
    })

    return ticket
  }

  async addReply(customer: PortalCustomer, ticketId: string, body: string) {
    if (!body?.trim()) throw new ValidationError('Reply cannot be empty')

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, customerId: customer.id, companyId: customer.companyId, deletedAt: null },
    })
    if (!ticket) throw new NotFoundError('Ticket not found')

    const reply = await prisma.ticketReply.create({
      data: { ticketId, customerId: customer.id, body, isInternal: false },
    })

    await timeline.addEntry({
      companyId: customer.companyId, customerId: customer.id,
      entryType: 'TICKET', direction: 'INBOUND',
      subject:   `Customer replied on ticket ${ticket.ticketNumber}`,
      body,
      refEntityType: 'TICKET', refEntityId: ticketId,
    })

    if (ticket.assignedTo) {
      await notifications.create({
        companyId: customer.companyId, userId: ticket.assignedTo,
        type: 'TICKET_UPDATED', title: `Customer replied: ${ticket.title}`,
        entityType: 'TICKET', entityId: ticketId,
      })
    }

    return reply
  }
}

export const portalService = new PortalService()
