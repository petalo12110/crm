import { useState } from 'react'
import { Plus, Clock, CheckCircle2, Circle, XCircle, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button }     from '@/components/ui/Button'
import { Select }     from '@/components/ui/FormControls'
import { Modal }      from '@/components/ui/Overlay'
import { Badge }      from '@/components/ui/Badge'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { formatDate, formatFullName }           from '@/lib/formatters'
import { TaskForm, TaskFormSubmit }             from '../components/TaskForm'
import { useTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus } from '../hooks/useTasks'

// Status metadata
const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string; next: string[] }> = {
  OPEN:        { label: 'Open',        icon: Circle,        color: 'text-primary',  next: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
  IN_PROGRESS: { label: 'In Progress', icon: Clock,         color: 'text-warning',  next: ['OPEN', 'COMPLETED', 'CANCELLED'] },
  COMPLETED:   { label: 'Completed',   icon: CheckCircle2,  color: 'text-success',  next: ['OPEN', 'IN_PROGRESS'] },
  CANCELLED:   { label: 'Cancelled',   icon: XCircle,       color: 'text-danger',   next: ['OPEN'] },
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW:    'bg-surface-3 text-text-secondary',
  MEDIUM: 'bg-primary/10 text-primary',
  HIGH:   'bg-warning/10 text-warning',
  URGENT: 'bg-danger/10 text-danger',
}

// Inline status picker — cycles through valid next states
function StatusPicker({ taskId, current }: { taskId: string; current: string }) {
  const [open, setOpen]   = useState(false)
  const updateStatus      = useUpdateTaskStatus()
  const meta              = STATUS_META[current] ?? STATUS_META.OPEN
  const Icon              = meta.icon

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium
          border border-current/20 transition-colors hover:opacity-80 ${meta.color}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">{meta.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-md border
            border-border bg-surface shadow-modal py-1">
            {meta.next.map(nextStatus => {
              const n = STATUS_META[nextStatus]
              const NIcon = n.icon
              return (
                <button
                  key={nextStatus}
                  onClick={() => {
                    updateStatus.mutate({ id: taskId, status: nextStatus })
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 ${n.color}`}
                >
                  <NIcon className="h-4 w-4" />
                  {n.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// Task row
function TaskRow({ task, onEdit }: { task: Record<string, unknown>; onEdit: (t: Record<string, unknown>) => void }) {
  const isOverdue = task.dueDate
    && new Date(task.dueDate as string) < new Date()
    && !['COMPLETED', 'CANCELLED'].includes(task.status as string)

  const assignee = task.assignee as { firstName: string; lastName: string } | null

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors
      ${task.status === 'COMPLETED' ? 'border-border bg-surface-2 opacity-70' : 'border-border bg-surface hover:bg-surface-2'}`}>

      {/* Status picker */}
      <div className="mt-0.5 shrink-0">
        <StatusPicker taskId={task.id as string} current={task.status as string} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={() => onEdit(task)} role="button">
        <p className={`text-sm font-medium leading-snug
          ${task.status === 'COMPLETED' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {task.title as string}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {assignee && <span>{formatFullName(assignee.firstName, assignee.lastName)}</span>}
          {!!(task.dueDate as string) && (
            <span className={isOverdue ? 'font-semibold text-danger' : ''}>
              Due {formatDate(task.dueDate as string)}
            </span>
          )}
          {!!(task.description as string) && (
            <span className="hidden truncate sm:inline max-w-[200px] text-text-muted">
              {task.description as string}
            </span>
          )}
        </div>
      </div>

      {/* Priority badge */}
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium
        ${PRIORITY_COLOR[task.priority as string] ?? PRIORITY_COLOR.MEDIUM}`}>
        {task.priority as string}
      </span>
    </div>
  )
}

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask]     = useState<Record<string, unknown> | null>(null)

  const filters: Record<string, unknown> = {
    ...(statusFilter   && { status:   statusFilter }),
    ...(priorityFilter && { priority: priorityFilter }),
  }

  const { data, isLoading, isError, refetch } = useTasks(filters)
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask((editTask?.id as string) ?? '')

  const tasks = data?.data ?? []
  const total = data?.meta?.total ?? tasks.length

  // Group by status for display
  const open       = tasks.filter((t: Record<string,unknown>) => t.status === 'OPEN')
  const inProgress = tasks.filter((t: Record<string,unknown>) => t.status === 'IN_PROGRESS')
  const completed  = tasks.filter((t: Record<string,unknown>) => t.status === 'COMPLETED')
  const cancelled  = tasks.filter((t: Record<string,unknown>) => t.status === 'CANCELLED')
  const doneCount  = completed.length + cancelled.length

  // Standard task-tool convention: active work (Open/In Progress) is what
  // you see by default, done items stay out of the way behind a toggle
  // rather than piling up in the main view forever. If someone explicitly
  // filters to Completed/Cancelled via the status dropdown, always honor
  // that regardless of the toggle.
  const explicitDoneFilter = statusFilter === 'COMPLETED' || statusFilter === 'CANCELLED'
  const shouldShowDone = showDone || explicitDoneFilter

  const handleCreate = (values: TaskFormSubmit) => {
    createMutation.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => setCreateOpen(false),
    })
  }

  const handleUpdate = (values: TaskFormSubmit) => {
    updateMutation.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => setEditTask(null),
    })
  }

  function TaskGroup({ label, items, color }: { label: string; items: Record<string,unknown>[]; color: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <div className={`mb-2 flex items-center gap-2`}>
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
          <span className="text-xs text-text-muted">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map(task => (
            <TaskRow key={task.id as string} task={task} onEdit={t => setEditTask(t)} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Tasks"
        subtitle={`${total} tasks`}
        action={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="flex-1 min-w-[130px] max-w-[160px]">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="flex-1 min-w-[130px] max-w-[160px]">
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
        {!explicitDoneFilter && doneCount > 0 && (
          <button
            onClick={() => setShowDone(s => !s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
              ${showDone
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border-strong text-text-secondary hover:border-primary hover:text-primary'}`}
          >
            {showDone ? 'Hide' : 'Show'} completed &amp; cancelled ({doneCount})
          </button>
        )}
      </div>

      {isError   && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <LoadingState />}

      {!isLoading && !isError && tasks.length === 0 && (
        <EmptyState
          title="No tasks"
          description="Create a task to get started."
          action={<Button onClick={() => setCreateOpen(true)}>New Task</Button>}
        />
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="space-y-6">
          <TaskGroup label="In Progress" items={inProgress} color="bg-warning" />
          <TaskGroup label="Open"        items={open}       color="bg-primary" />
          {shouldShowDone && (
            <>
              <TaskGroup label="Completed"   items={completed}  color="bg-success" />
              <TaskGroup label="Cancelled"   items={cancelled}  color="bg-danger" />
            </>
          )}
          {!shouldShowDone && open.length === 0 && inProgress.length === 0 && (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
              <p className="text-sm font-medium text-text-primary">All caught up</p>
              <p className="mt-1 text-sm text-text-secondary">
                {doneCount} completed or cancelled task{doneCount === 1 ? '' : 's'} — hidden by default.{' '}
                <button onClick={() => setShowDone(true)} className="text-primary hover:underline">Show them</button>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Task">
        <TaskForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Edit Task">
        {editTask && (
          <TaskForm
            defaultValues={{
              title:       editTask.title as string,
              description: editTask.description as string,
              priority:    editTask.priority as string,
              dueDate:     editTask.dueDate as string,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditTask(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>
    </div>
  )
}
