import { Router, Request, Response, NextFunction } from 'express'
import multer           from 'multer'
import * as crypto      from 'crypto'
import * as path        from 'path'
import { authenticate } from '../../delivery/middleware/authenticate'
import { authorize, ROLES } from '../../delivery/middleware/authorize'
import { prisma }       from '../../infrastructure/database/prisma'
import { storage }      from '../../infrastructure/storage/StorageProvider'
import { auditService } from '../audit/audit.service'
import { requireCompanyId } from '../../core/utils/index'
import { config }       from '../../config/env'
import { z }            from 'zod'

const router: Router = Router()

// Multer in-memory storage — we handle persistence ourselves via StorageProvider
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Allowlist of safe mime types
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv',
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${file.mimetype} is not permitted`))
    }
  },
})

const UploadMetaSchema = z.object({
  entityType: z.enum(['CUSTOMER','LEAD','OPPORTUNITY','TASK','TICKET','COMPANY']),
  entityId:   z.string().uuid(),
  folder:     z.string().default('/'),
})

// Upload file
router.post(
  '/upload',
  authenticate,
  authorize(ROLES.ALL),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } })
      }

      const meta     = UploadMetaSchema.parse(req.body)
      const ext      = path.extname(req.file.originalname)
      const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      const storageKey = `${requireCompanyId(req.user)}/${meta.entityType.toLowerCase()}/${meta.entityId}/${crypto.randomUUID()}${ext}`

      await storage.upload(storageKey, req.file.buffer, {
        mimeType:     req.file.mimetype,
        originalName: req.file.originalname,
      })

      const doc = await prisma.document.create({
        data: {
          companyId:    requireCompanyId(req.user),
          uploadedBy:   req.user.id,
          entityType:   meta.entityType as never,
          entityId:     meta.entityId,
          folder:       meta.folder,
          originalName: req.file.originalname,
          storageKey,
          mimeType:     req.file.mimetype,
          sizeBytes:    BigInt(req.file.size),
          checksum,
        },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      await auditService.log({
        companyId:  req.user.companyId,
        userId:     req.user.id,
        action:     'FILE_UPLOAD',
        entityType: meta.entityType,
        entityId:   meta.entityId,
        newValues:  { fileName: req.file.originalname, sizeBytes: req.file.size },
      })

      res.status(201).json({
        success: true,
        data: { ...doc, sizeBytes: Number(doc.sizeBytes) },
      })
    } catch (err) { next(err) }
  }
)

// List documents for an entity
router.get('/', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, folder } = req.query as Record<string, string>
    const docs = await prisma.document.findMany({
      where: {
        companyId: requireCompanyId(req.user),
        deletedAt: null,
        ...(entityType && { entityType: entityType as never }),
        ...(entityId   && { entityId }),
        ...(folder     && { folder }),
      },
      orderBy: { createdAt: 'desc' },
      include: { uploader: { select: { id: true, firstName: true, lastName: true } } },
    })
    res.json({
      success: true,
      data: docs.map((d: typeof docs[0]) => ({ ...d, sizeBytes: Number(d.sizeBytes) })),
    })
  } catch (err) { next(err) }
})

// Get document metadata
router.get('/:id', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, companyId: requireCompanyId(req.user), deletedAt: null },
    })
    if (!doc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } })
    res.json({ success: true, data: { ...doc, sizeBytes: Number(doc.sizeBytes) } })
  } catch (err) { next(err) }
})

// Download — streams file through app layer (auth check enforced)
router.get('/:id/download', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, companyId: requireCompanyId(req.user), deletedAt: null },
    })
    if (!doc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } })

    const buffer = await storage.download(doc.storageKey)
    res.setHeader('Content-Type',        doc.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`)
    res.setHeader('Content-Length',      buffer.length)
    res.end(buffer)
  } catch (err) { next(err) }
})

// Soft delete
router.delete('/:id', authenticate, authorize(ROLES.CAN_DELETE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, companyId: requireCompanyId(req.user), deletedAt: null },
    })
    if (!doc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } })

    await prisma.document.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })

    await auditService.log({
      companyId:  req.user.companyId,
      userId:     req.user.id,
      action:     'FILE_DELETE',
      entityType: doc.entityType,
      entityId:   doc.entityId,
      oldValues:  { fileName: doc.originalName },
    })

    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as documentsRouter }
