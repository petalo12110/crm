import { Request, Response, NextFunction } from 'express'
import { CustomersService }   from './customers.service'
import { CustomerFiltersSchema, CreateCustomerSchema, UpdateCustomerSchema } from '@crm/shared'
import { z } from 'zod'

const BulkAssignSchema = z.object({
  ids:        z.array(z.string().uuid()).min(1),
  assignedTo: z.string().uuid(),
})

const BulkTagSchema = z.object({
  ids:  z.array(z.string().uuid()).min(1),
  tags: z.array(z.string().max(50)).min(1),
})

const SendEmailSchema = z.object({
  subject: z.string().min(1).max(255),
  body:    z.string().min(1).max(10_000),
})

export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = CustomerFiltersSchema.parse(req.query)
      const result  = await this.service.list(req.user, filters)
      res.json({ success: true, ...result })
    } catch (err) { next(err) }
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(req.user, req.params.id)
      res.json({ success: true, data })
    } catch (err) { next(err) }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto  = CreateCustomerSchema.parse(req.body)
      const data = await this.service.create(req.user, dto)
      res.status(201).json({ success: true, data })
    } catch (err) { next(err) }
  }

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto  = UpdateCustomerSchema.parse(req.body)
      const data = await this.service.update(req.user, req.params.id, dto)
      res.json({ success: true, data })
    } catch (err) { next(err) }
  }

  softDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.softDelete(req.user, req.params.id)
      res.status(204).send()
    } catch (err) { next(err) }
  }

  restore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.restore(req.user, req.params.id)
      res.json({ success: true })
    } catch (err) { next(err) }
  }

  sendEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = SendEmailSchema.parse(req.body)
      const result = await this.service.sendEmail(req.user, req.params.id, dto)
      res.json({ success: true, data: result })
    } catch (err) { next(err) }
  }

  bulkAssign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = BulkAssignSchema.parse(req.body)
      await this.service.bulkAssign(req.user, dto.ids, dto.assignedTo)
      res.json({ success: true })
    } catch (err) { next(err) }
  }

  bulkTag = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = BulkTagSchema.parse(req.body)
      await this.service.bulkTag(req.user, dto.ids, dto.tags)
      res.json({ success: true })
    } catch (err) { next(err) }
  }
}
