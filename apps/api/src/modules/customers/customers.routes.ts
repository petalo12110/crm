import { Router, Request, Response, NextFunction } from 'express'
import multer                   from 'multer'
import { authenticate }         from '../../delivery/middleware/authenticate'
import { authorize, ROLES }     from '../../delivery/middleware/authorize'
import { CustomersController }  from './customers.controller'
import { CustomersService }     from './customers.service'
import { CustomersRepository }  from './customers.repository'
import { AuditService }         from '../audit/audit.service'
import { TimelineService }      from '../communications/timeline.service'
import { NotificationsService } from '../notifications/notifications.service'
import { timelineRouter }       from '../communications/timeline.routes'
import { csvToObjects }         from '../../core/utils/csv'
import { CreateCustomerSchema } from '@crm/shared'
import { ValidationError }      from '../../core/errors'

const router : import("express").Router = Router()
const service = new CustomersService(
  new CustomersRepository(),
  new AuditService(),
  new TimelineService(),
  new NotificationsService(),
)
const controller = new CustomersController(service)

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB — plenty for a customer list CSV
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) cb(null, true)
    else cb(new ValidationError('File must be a .csv'))
  },
})

router.get(  '/',           authenticate, authorize(ROLES.ALL),            controller.list)
router.post( '/',           authenticate, authorize(ROLES.CAN_WRITE_CUSTOMERS), controller.create)
router.get(  '/:id',        authenticate, authorize(ROLES.ALL),            controller.getById)
router.patch('/:id',        authenticate, authorize(ROLES.CAN_WRITE_CUSTOMERS), controller.update)
router.delete('/:id',       authenticate, authorize(ROLES.CAN_DELETE),     controller.softDelete)
router.post( '/:id/restore',authenticate, authorize(ROLES.CAN_DELETE),     controller.restore)
router.post( '/:id/send-email', authenticate, authorize(ROLES.CAN_WRITE_CUSTOMERS), controller.sendEmail)

// Bulk operations
router.post('/bulk/assign', authenticate, authorize(ROLES.MANAGEMENT),      controller.bulkAssign)
router.post('/bulk/tag',    authenticate, authorize(ROLES.CAN_WRITE_CUSTOMERS), controller.bulkTag)

// CSV import — accepts a "file" field, one customer per row. Column
// headers are matched case-insensitively (see CSV_COLUMN_MAP below).
// Rejects the whole file only for structural problems (no file, no
// header row); individual bad rows are skipped and reported back rather
// than failing the entire import, since a typo in row 200 of 500
// shouldn't cost you the other 499.
const CSV_COLUMN_MAP: Record<string, string> = {
  firstname: 'firstName', 'first name': 'firstName',
  lastname:  'lastName',  'last name':  'lastName',
  email: 'email', phone: 'phone', 'phone alt': 'phoneAlt', altphone: 'phoneAlt',
  address: 'addressLine1', address1: 'addressLine1', 'address line 1': 'addressLine1',
  address2: 'addressLine2', 'address line 2': 'addressLine2',
  city: 'city', province: 'province', state: 'province',
  postalcode: 'postalCode', 'postal code': 'postalCode', zip: 'postalCode',
  country: 'country', company: 'companyName', companyname: 'companyName', 'company name': 'companyName',
  industry: 'industry', website: 'website', taxid: 'taxId', 'tax id': 'taxId',
  status: 'status', type: 'customerType', customertype: 'customerType', 'customer type': 'customerType',
  tags: 'tags', notes: 'notes',
}

router.post(
  '/import',
  authenticate,
  authorize(ROLES.CAN_WRITE_CUSTOMERS),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new ValidationError('No file uploaded — attach a .csv file as "file"')

      const rawRows = csvToObjects(req.file.buffer.toString('utf-8'))
      if (rawRows.length === 0) throw new ValidationError('CSV has no data rows')
      if (rawRows.length > 5000) throw new ValidationError('CSV has too many rows (max 5,000 per import — split into smaller files)')

      const results = { imported: 0, failed: 0, errors: [] as Array<{ row: number; message: string }> }

      for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i]
        const mapped: Record<string, unknown> = {}
        for (const [csvKey, value] of Object.entries(raw)) {
          const field = CSV_COLUMN_MAP[csvKey]
          if (!field || value === '') continue
          mapped[field] = field === 'tags'
            ? value.split(';').map(t => t.trim()).filter(Boolean)
            : value
        }

        // A row with neither a name nor an email isn't a usable customer
        // record — skip it rather than creating a blank entry.
        if (!mapped.firstName && !mapped.lastName && !mapped.email) {
          results.failed++
          results.errors.push({ row: i + 2, message: 'Row has no name or email — skipped' })
          continue
        }

        const parsed = CreateCustomerSchema.safeParse(mapped)
        if (!parsed.success) {
          results.failed++
          results.errors.push({
            row: i + 2, // +1 for header row, +1 for 1-indexing
            message: parsed.error.issues.map(iss => iss.message).join('; '),
          })
          continue
        }

        try {
          await service.create(req.user, parsed.data)
          results.imported++
        } catch (err) {
          results.failed++
          results.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Failed to create' })
        }
      }

      res.json({ success: true, data: results })
    } catch (err) { next(err) }
  }
)

// Nested timeline
router.use('/:customerId/timeline', timelineRouter)

export { router as customersRouter }
