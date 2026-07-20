import { Router, Request, Response, NextFunction } from 'express'
import { BaseRepository }      from '../../infrastructure/database/BaseRepository'
import { AuditService }        from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { authenticate }        from '../../delivery/middleware/authenticate'
import { authorize, ROLES }    from '../../delivery/middleware/authorize'
import { NotFoundError }       from '../../core/errors/index'
import { requireCompanyId }    from '../../core/utils/index'
import type { AuthUser }       from '../../core/types/index'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskFiltersSchema,
  CreateCommentSchema,
} from '@crm/shared'

// ── Repository ─────────────────────────────────────────────

class TasksRepository extends BaseRepository {
  async findMany(companyId: string, filters: Record<string, unknown>) {
    const now = new Date()
    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      ...(filters.status     ? { status:     filters.status as never }    : {}),
      ...(filters.priority   ? { priority:   filters.priority as never }  : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo as string}: {}),
      ...(filters.entityType ? { entityType: filters.entityType as string}: {}),
      ...(filters.entityId   ? { entityId:   filters.entityId as string }  : {}),
      ...(filters.overdue ? { dueDate: { lt: now }, status: { notIn: ['COMPLETED' as never, 'CANCELLED' as never] } } : {}),
    }

    const limit  = (filters.limit as number) ?? 25
    const cursor = filters.cursor as string | undefined
    const [items, total] = await this.db.$transaction([
      this.db.task.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          creator:  { select: { id: true, firstName: true, lastName: true } },
          _count:   { select: { comments: true } },
        },
        ...this.buildCursorArgs(cursor, limit),
      }),
      this.db.task.count({ where }),
    ])

    const { data, meta } = this.buildPageResult(items, limit)
    return { data, meta: { ...meta, total } }
  }

  async findById(id: string, companyId: string) {
    return this.db.task.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        creator:  { select: { id: true, firstName: true, lastName: true } },
        comments: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })
  }

  async create(companyId: string, data: Record<string, unknown>, createdBy: string) {
    return this.db.task.create({
      data: {
        companyId,
        createdBy,
        title:          data.title as string,
        description:    data.description as string | undefined,
        priority:       (data.priority ?? 'MEDIUM') as never,
        status:         (data.status ?? 'OPEN') as never,
        dueDate:        data.dueDate ? new Date(data.dueDate as string) : undefined,
        assignedTo:     data.assignedTo as string | undefined,
        entityType:     data.entityType as string | undefined,
        entityId:       data.entityId   as string | undefined,
        estimatedMins:  data.estimatedMins as number | undefined,
        recurrenceRule: data.recurrenceRule as string | undefined,
      },
    })
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.db.task.update({
      where: { id },
      data: Object.assign({}, data, data.status === 'COMPLETED' ? { completedAt: new Date() } : {}, data.dueDate ? { dueDate: new Date(data.dueDate as string) } : {}) as never,
    })
  }

  async addComment(taskId: string, userId: string, body: string) {
    return this.db.taskComment.create({
      data: { taskId, userId, body },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  async softDelete(id: string) {
    return this.db.task.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}

// ── Service ────────────────────────────────────────────────

class TasksService {
  constructor(
    private readonly repo:          TasksRepository,
    private readonly audit:         AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, filters: Record<string, unknown>) {
    return this.repo.findMany(requireCompanyId(user), filters)
  }

  async getById(user: AuthUser, taskId: string) {
    const task = await this.repo.findById(taskId, requireCompanyId(user))
    if (!task) throw new NotFoundError('Task not found')
    return task
  }

  async create(user: AuthUser, dto: Record<string, unknown>) {
    const companyId = requireCompanyId(user)
    const task = await this.repo.create(companyId, dto, user.id)

    if (task.assignedTo && task.assignedTo !== user.id) {
      await this.notifications.create({
        companyId, userId: task.assignedTo,
        type:  'TASK_ASSIGNED',
        title: `New task: ${task.title}`,
        body:  task.description ?? undefined,
        entityType: 'TASK', entityId: task.id,
        url:   `/tasks/${task.id}`, priority: task.priority === 'URGENT' ? 3 : 1,
      })
    }

    await this.audit.log({
      companyId, userId: user.id,
      action: 'CREATE', entityType: 'tasks', entityId: task.id,
      newValues: dto,
    })

    return task
  }

  async update(user: AuthUser, taskId: string, dto: Record<string, unknown>) {
    const companyId = requireCompanyId(user)
    const existing = await this.getById(user, taskId)
    const updated  = await this.repo.update(taskId, dto)

    // Notify new assignee if changed
    if (dto.assignedTo && dto.assignedTo !== existing.assignedTo && dto.assignedTo !== user.id) {
      await this.notifications.create({
        companyId, userId: dto.assignedTo as string,
        type: 'TASK_ASSIGNED', title: `Task assigned to you: ${existing.title}`,
        entityType: 'TASK', entityId: taskId, url: `/tasks/${taskId}`,
      })
    }

    return updated
  }

  async comment(user: AuthUser, taskId: string, body: string) {
    await this.getById(user, taskId)
    return this.repo.addComment(taskId, user.id, body)
  }

  async softDelete(user: AuthUser, taskId: string) {
    await this.getById(user, taskId)
    await this.repo.softDelete(taskId)
  }
}

// ── Routes ─────────────────────────────────────────────────

const svc    = new TasksService(new TasksRepository(), new AuditService(), new NotificationsService())
const router: Router = Router()

router.get('/', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = TaskFiltersSchema.parse(req.query)
    res.json({ success: true, ...await svc.list(req.user, filters as Record<string, unknown>) })
  } catch (err) { next(err) }
})

router.post('/', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateTaskSchema.parse(req.body)
    res.status(201).json({ success: true, data: await svc.create(req.user, dto as Record<string, unknown>) })
  } catch (err) { next(err) }
})

router.get('/overdue', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = { overdue: true, assignedTo: req.user.id, limit: 50 }
    res.json({ success: true, ...await svc.list(req.user, filters) })
  } catch (err) { next(err) }
})

router.get('/:id', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await svc.getById(req.user, req.params.id) })
  } catch (err) { next(err) }
})

router.patch('/:id', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = UpdateTaskSchema.parse(req.body)
    res.json({ success: true, data: await svc.update(req.user, req.params.id, dto as Record<string, unknown>) })
  } catch (err) { next(err) }
})

router.post('/:id/comments', authenticate, authorize(ROLES.ALL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = CreateCommentSchema.parse(req.body)
    res.status(201).json({ success: true, data: await svc.comment(req.user, req.params.id, body) })
  } catch (err) { next(err) }
})

router.delete('/:id', authenticate, authorize(ROLES.CAN_DELETE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.softDelete(req.user, req.params.id)
    res.status(204).send()
  } catch (err) { next(err) }
})

export { router as tasksRouter }
