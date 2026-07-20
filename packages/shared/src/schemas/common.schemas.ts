import { z } from 'zod'
import { optionalEmail, optionalUrl } from './zod-helpers'

// ── Opportunities ──────────────────────────────────────────
export const CreateOpportunitySchema = z.object({
  title:           z.string().min(1).max(255),
  customerId:      z.string().uuid().optional().nullable(),
  leadId:          z.string().uuid().optional().nullable(),
  stage:           z.enum([
    'PROSPECTING','QUALIFICATION','NEEDS_ANALYSIS','VALUE_PROPOSITION',
    'DECISION_MAKERS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST'
  ]).default('PROSPECTING'),
  expectedRevenue: z.coerce.number().nonnegative().optional().nullable(),
  probability:     z.coerce.number().min(0).max(100).optional().nullable(),
  expectedClose:   z.string().date().optional().nullable(),
  quotedValue:     z.coerce.number().nonnegative().optional().nullable(),
  competitors:     z.array(z.string().max(255)).optional().default([]),
  products:        z.array(z.string().max(255)).optional().default([]),
  assignedTo:      z.string().uuid().optional().nullable(),
  notes:           z.string().max(10000).optional().nullable(),
})
export type CreateOpportunityInput = z.infer<typeof CreateOpportunitySchema>
export const UpdateOpportunitySchema = CreateOpportunitySchema.partial()
export type UpdateOpportunityInput  = z.infer<typeof UpdateOpportunitySchema>

// ── Tasks ──────────────────────────────────────────────────
export const CreateTaskSchema = z.object({
  title:         z.string().min(1).max(255),
  description:   z.string().max(10000).optional().nullable(),
  priority:      z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM'),
  status:        z.enum(['OPEN','IN_PROGRESS','COMPLETED','CANCELLED']).default('OPEN'),
  dueDate:       z.string().datetime().optional().nullable(),
  assignedTo:    z.string().uuid().optional().nullable(),
  entityType:    z.enum(['CUSTOMER','LEAD','OPPORTUNITY','TICKET']).optional().nullable(),
  entityId:      z.string().uuid().optional().nullable(),
  estimatedMins: z.coerce.number().int().nonnegative().optional().nullable(),
  recurrenceRule:z.string().max(500).optional().nullable(),
})
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export const UpdateTaskSchema = CreateTaskSchema.partial()
export type UpdateTaskInput  = z.infer<typeof UpdateTaskSchema>

export const TaskFiltersSchema = z.object({
  status:     z.enum(['OPEN','IN_PROGRESS','COMPLETED','CANCELLED']).optional(),
  priority:   z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(),
  assignedTo: z.string().uuid().optional(),
  entityType: z.string().optional(),
  entityId:   z.string().uuid().optional(),
  overdue:    z.coerce.boolean().optional(),
  search:     z.string().max(200).optional(),
  sort:       z.string().max(50).optional(),
  limit:      z.coerce.number().min(1).max(100).default(25),
  cursor:     z.string().optional(),
})
export type TaskFilters = z.infer<typeof TaskFiltersSchema>

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(5000),
})
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>

// ── Tickets ────────────────────────────────────────────────
export const CreateTicketSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  priority:    z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  customerId:  z.string().uuid().optional().nullable(),
  department:  z.string().max(100).optional().nullable(),
  category:    z.string().max(100).optional().nullable(),
  assignedTo:  z.string().uuid().optional().nullable(),
  slaDeadline: z.string().datetime().optional().nullable(),
})
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>
export const UpdateTicketSchema = CreateTicketSchema.partial()
export type UpdateTicketInput  = z.infer<typeof UpdateTicketSchema>

export const TicketFiltersSchema = z.object({
  status:     z.enum(['OPEN','IN_PROGRESS','ON_HOLD','RESOLVED','CLOSED']).optional(),
  priority:   z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  assignedTo: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  department: z.string().optional(),
  slaBreached:z.coerce.boolean().optional(),
  search:     z.string().max(200).optional(),
  sort:       z.string().max(50).optional(),
  limit:      z.coerce.number().min(1).max(100).default(25),
  cursor:     z.string().optional(),
})
export type TicketFilters = z.infer<typeof TicketFiltersSchema>

export const CreateTicketReplySchema = z.object({
  body:       z.string().min(1).max(10000),
  isInternal: z.boolean().default(false),
})
export type CreateTicketReplyInput = z.infer<typeof CreateTicketReplySchema>

export const EscalateTicketSchema = z.object({
  escalateTo:  z.string().uuid(),
  reason:      z.string().min(1).max(1000),
  newPriority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
})
export type EscalateTicketInput = z.infer<typeof EscalateTicketSchema>

// ── Calendar ───────────────────────────────────────────────
export const CreateCalendarEventSchema = z.object({
  title:         z.string().min(1).max(255),
  description:   z.string().max(5000).optional().nullable(),
  eventType:     z.enum(['MEETING','CALL','FOLLOW_UP','DEADLINE','REMINDER','OTHER']).default('OTHER'),
  startsAt:      z.string().datetime(),
  endsAt:        z.string().datetime().optional().nullable(),
  allDay:        z.boolean().default(false),
  location:      z.string().max(500).optional().nullable(),
  entityType:    z.string().max(50).optional().nullable(),
  entityId:      z.string().uuid().optional().nullable(),
  reminderMins:  z.array(z.number().int().nonnegative()).optional().default([30]),
  recurrenceRule:z.string().max(500).optional().nullable(),
  attendeeIds:   z.array(z.string().uuid()).optional().default([]),
})
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventSchema>
export const UpdateCalendarEventSchema = CreateCalendarEventSchema.partial()
export type UpdateCalendarEventInput  = z.infer<typeof UpdateCalendarEventSchema>

// ── Company settings ───────────────────────────────────────
export const UpdateCompanySettingsSchema = z.object({
  name:             z.string().min(1).max(255).optional(),
  email:            optionalEmail({ nullable: true }),
  phone:            z.string().max(50).optional().nullable(),
  addressLine1:     z.string().max(255).optional().nullable(),
  city:             z.string().max(100).optional().nullable(),
  province:         z.string().max(100).optional().nullable(),
  postalCode:       z.string().max(20).optional().nullable(),
  country:          z.string().length(2).optional().nullable(),
  website:          optionalUrl({ nullable: true }),
  timezone:         z.string().max(100).optional(),
  currency:         z.string().length(3).optional(),
  language:         z.string().max(10).optional(),
  primaryColor:     z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  accentColor:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  taxLabel:         z.string().max(50).optional().nullable(),
  taxRate:          z.coerce.number().min(0).max(100).optional(),
  workingHoursStart:z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingHoursEnd:  z.string().regex(/^\d{2}:\d{2}$/).optional(),
})
export type UpdateCompanySettingsInput = z.infer<typeof UpdateCompanySettingsSchema>

export const UpdateSmtpSettingsSchema = z.object({
  smtpHost: z.string().min(1).max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().min(1).max(255),
  smtpPass: z.string().min(1),
  smtpFrom: z.string().email(),
})
export type UpdateSmtpSettingsInput = z.infer<typeof UpdateSmtpSettingsSchema>

// ── Pagination ─────────────────────────────────────────────
export const PaginationSchema = z.object({
  limit:  z.coerce.number().min(1).max(100).default(25),
  cursor: z.string().optional(),
  sort:   z.string().max(50).optional(),
})
export type PaginationInput = z.infer<typeof PaginationSchema>
