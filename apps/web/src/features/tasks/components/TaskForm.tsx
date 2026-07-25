import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Select, Textarea } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'
import { localInputToISO, isoToLocalInput } from '@/lib/dates'

export interface TaskFormValues {
  title:        string
  description?: string
  priority:     string
  dueDate?:     string   // datetime-local input value
}

export interface TaskFormSubmit {
  title:        string
  description?: string
  priority:     string
  dueDate?:     string   // ISO string for API
}

export function TaskForm({
  defaultValues, onSubmit, onCancel, loading,
}: {
  defaultValues?: Partial<TaskFormValues>
  onSubmit: (values: TaskFormSubmit) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<TaskFormValues>({
    defaultValues: {
      priority: 'MEDIUM',
      ...defaultValues,
      dueDate: defaultValues?.dueDate ? isoToLocalInput(defaultValues.dueDate) : '',
    },
  })

  const handleFormSubmit = (values: TaskFormValues) => {
    onSubmit({
      ...values,
      dueDate: localInputToISO(values.dueDate),
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Title"
        error={errors.title?.message}
        {...register('title', { required: 'Title is required' })}
      />
      <Textarea label="Description" rows={3} {...register('description')} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Priority" {...register('priority')}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
        <Input label="Due date" type="datetime-local" {...register('dueDate')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Save task</Button>
      </div>
    </form>
  )
}
