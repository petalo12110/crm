import { z } from 'zod'
import { optionalEmail, optionalUrl } from './zod-helpers'

export const CreateCustomerSchema = z.object({
  firstName:    z.string().max(100).optional().nullable(),
  lastName:     z.string().max(100).optional().nullable(),
  email:        optionalEmail({ max: 255, nullable: true }),
  phone:        z.string().max(50).optional().nullable(),
  phoneAlt:     z.string().max(50).optional().nullable(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city:         z.string().max(100).optional().nullable(),
  province:     z.string().max(100).optional().nullable(),
  postalCode:   z.string().max(20).optional().nullable(),
  country:      z.string().length(2).optional().nullable(),
  companyName:  z.string().max(255).optional().nullable(),
  industry:     z.string().max(100).optional().nullable(),
  website:      optionalUrl({ max: 500, nullable: true }),
  taxId:        z.string().max(100).optional().nullable(),
  status:       z.enum(['ACTIVE','INACTIVE','PROSPECT','BLOCKED']).default('ACTIVE'),
  customerType: z.enum(['INDIVIDUAL','BUSINESS']).default('INDIVIDUAL'),
  tags:         z.array(z.string().max(50)).default([]),
  assignedTo:   z.string().uuid().optional().nullable(),
  notes:        z.string().max(10000).optional().nullable(),
  customFields: z.record(z.unknown()).optional().default({}),
})
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>

export const UpdateCustomerSchema = CreateCustomerSchema.partial()
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>

export const CustomerFiltersSchema = z.object({
  status:       z.enum(['ACTIVE','INACTIVE','PROSPECT','BLOCKED']).optional(),
  customerType: z.enum(['INDIVIDUAL','BUSINESS']).optional(),
  assignedTo:   z.string().uuid().optional(),
  country:      z.string().length(2).optional(),
  tags:         z.string().transform(s => s.split(',')).optional(),
  createdFrom:  z.string().datetime().optional(),
  createdTo:    z.string().datetime().optional(),
  search:       z.string().max(200).optional(),
  sort:         z.string().max(50).optional(),
  limit:        z.coerce.number().min(1).max(100).default(25),
  cursor:       z.string().optional(),
})
export type CustomerFilters = z.infer<typeof CustomerFiltersSchema>
