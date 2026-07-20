import { Badge } from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/FormControls'
import { formatDate, formatFullName } from '@/lib/formatters'
import { useUpdateTaskStatus } from '../hooks/useTasks'

interface Task {
  id: string
  title: string
  priority: string
  status: string
  dueDate: string | null
  assignee: { firstName: string; lastName: string } | null
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const updateStatus = useUpdateTaskStatus()

  const isOverdue = (task: Task) =>
    task.dueDate && new Date(task.dueDate) < new Date() && !['COMPLETED', 'CANCELLED'].includes(task.status)

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface">
      {tasks.map(task => (
        <div key={task.id} className="flex items-center gap-3 px-4 py-3">
          <Checkbox
            checked={task.status === 'COMPLETED'}
            onChange={e => updateStatus.mutate({ id: task.id, status: e.target.checked ? 'COMPLETED' : 'OPEN' })}
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
              {task.title}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
              {task.assignee && <span>{formatFullName(task.assignee.firstName, task.assignee.lastName)}</span>}
              {task.dueDate && (
                <span className={isOverdue(task) ? 'text-danger font-medium' : ''}>
                  Due {formatDate(task.dueDate)}
                </span>
              )}
            </div>
          </div>
          <Badge status={task.priority}>{task.priority}</Badge>
        </div>
      ))}
    </div>
  )
}
