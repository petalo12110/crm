import { z } from 'zod'
import { LeadStage } from '../constants/enums'
import { optionalEmail } from './zod-helpers'

const stageValues = Object.values(LeadStage) as [string, ...string[]]

export const CreateLeadSchema = z.object({
  title:         z.string().min(1).max(255),
  customerId:    z.string().uuid().optional().nullable(),
  source:        z.string().max(100).optional().nullable(),
  campaign:      z.string().max(255).optional().nullable(),
  stage:         z.enum(stageValues as [LeadStage, ...LeadStage[]]).default('NEW'),
  value:         z.coerce.number().nonnegative().optional().nullable(),
  probability:   z.coerce.number().min(0).max(100).optional().nullable(),
  expectedClose: z.string().date().optional().nullable(),
  assignedTo:    z.string().uuid().optional().nullable(),
  notes:         z.string().max(10000).optional().nullable(),
  tags:          z.array(z.string().max(50)).default([]),
  customFields:  z.record(z.unknown()).optional().default({}),
})
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

export const UpdateLeadSchema = CreateLeadSchema.partial()
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>

export const TransitionLeadStageSchema = z.object({
  stage: z.enum(stageValues as [LeadStage, ...LeadStage[]]),
  note:  z.string().max(1000).optional().nullable(),
})
export type TransitionLeadStageInput = z.infer<typeof TransitionLeadStageSchema>

export const LeadFiltersSchema = z.object({
  stage:       z.enum(stageValues as [LeadStage, ...LeadStage[]]).optional(),
  assignedTo:  z.string().uuid().optional(),
  customerId:  z.string().uuid().optional(),
  valueMin:    z.coerce.number().optional(),
  valueMax:    z.coerce.number().optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo:   z.string().datetime().optional(),
  search:      z.string().max(200).optional(),
  sort:        z.string().max(50).optional(),
  limit:       z.coerce.number().min(1).max(100).default(25),
  cursor:      z.string().optional(),
})
export type LeadFilters = z.infer<typeof LeadFiltersSchema>

export const ConvertLeadSchema = z.object({
  createCustomer: z.boolean().default(true),
  customerData:   z.object({
    email:       optionalEmail(),
    companyName: z.string().max(255).optional(),
  }).optional(),
})
export type ConvertLeadInput = z.infer<typeof ConvertLeadSchema>
