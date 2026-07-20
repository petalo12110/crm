import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday, getDay,
} from 'date-fns'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Overlay'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/FormControls'
import { LoadingState } from '@/components/ui/States'
import { useForm } from 'react-hook-form'
import { localInputToISO } from '@/lib/dates'

function useCalendarEvents(month: Date) {
  const startsFrom = startOfMonth(month).toISOString()
  const startsTo   = endOfMonth(month).toISOString()
  return useQuery({
    queryKey: ['calendar', 'events', format(month, 'yyyy-MM')],
    queryFn:  () => api.get('/calendar/events', { params: { startsFrom, startsTo } }).then(r => r.data.data),
  })
}

interface EventFormValues {
  title:     string
  eventType: string
  startsAt:  string
  endsAt?:   string
  location?: string
}

const EVENT_COLORS: Record<string, string> = {
  MEETING:   'bg-blue-100 text-blue-700',
  CALL:      'bg-green-100 text-green-700',
  FOLLOW_UP: 'bg-amber-100 text-amber-700',
  DEADLINE:  'bg-red-100 text-red-700',
  REMINDER:  'bg-violet-100 text-violet-700',
  OTHER:     'bg-surface-3 text-text-secondary',
}

function CreateEventForm({ onSubmit, onCancel, loading }: {
  onSubmit: (v: EventFormValues) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<EventFormValues>({
    defaultValues: { eventType: 'MEETING' },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Title" placeholder="e.g. Client meeting"
        error={errors.title?.message}
        {...register('title', { required: 'Title is required' })} />
      <Select label="Event type" {...register('eventType')}>
        <option value="MEETING">Meeting</option>
        <option value="CALL">Call</option>
        <option value="FOLLOW_UP">Follow-up</option>
        <option value="DEADLINE">Deadline</option>
        <option value="REMINDER">Reminder</option>
        <option value="OTHER">Other</option>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Starts at" type="datetime-local"
          error={errors.startsAt?.message}
          {...register('startsAt', { required: 'Start time is required' })} />
        <Input label="Ends at (optional)" type="datetime-local" {...register('endsAt')} />
      </div>
      <Input label="Location (optional)" placeholder="Office, Zoom, Phone..." {...register('location')} />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Create event</Button>
      </div>
    </form>
  )
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [createOpen, setCreateOpen]     = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null)
  const qc = useQueryClient()

  const { data: events = [], isLoading } = useCalendarEvents(currentMonth)

  const createMutation = useMutation({
    mutationFn: (values: EventFormValues) =>
      api.post('/calendar/events', {
        title:     values.title,
        eventType: values.eventType,
        location:  values.location || undefined,
        startsAt:  localInputToISO(values.startsAt),
        endsAt:    localInputToISO(values.endsAt),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); setCreateOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['calendar'] }); setSelectedEvent(null) },
  })

  const days     = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startDow = getDay(startOfMonth(currentMonth))

  const eventsOnDay = (day: Date) =>
    (events as Record<string, unknown>[]).filter(e => isSameDay(new Date(e.startsAt as string), day))

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Calendar"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Event</Button>}
      />

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="rounded p-1.5 hover:bg-surface-3 text-text-secondary"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="text-lg font-semibold text-text-primary">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="rounded p-1.5 hover:bg-surface-3 text-text-secondary"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {isLoading ? <LoadingState /> : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-text-secondary">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`pre-${i}`} className="min-h-[100px] border-b border-r border-border bg-surface-2/50" />
            ))}
            {days.map(day => {
              const dayEvents = eventsOnDay(day)
              return (
                <div key={day.toISOString()}
                  className={`min-h-[100px] border-b border-r border-border p-1.5 ${isToday(day) ? 'bg-primary/5' : ''}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium
                    ${isToday(day) ? 'bg-primary text-white' : 'text-text-primary'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0,3).map(e => (
                      <button key={e.id as string} onClick={() => setSelectedEvent(e)}
                        className={`w-full truncate rounded px-1 py-0.5 text-left text-xs font-medium
                          ${EVENT_COLORS[e.eventType as string] ?? EVENT_COLORS.OTHER}`}
                        title={e.title as string}>
                        {e.title as string}
                      </button>
                    ))}
                    {dayEvents.length > 3 && <p className="text-xs text-text-muted px-1">+{dayEvents.length - 3} more</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_COLORS).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${cls.split(' ')[0]}`} />
            <span className="text-xs text-text-secondary capitalize">{type.replace('_',' ').toLowerCase()}</span>
          </div>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Event">
        <CreateEventForm onSubmit={v => createMutation.mutate(v)} onCancel={() => setCreateOpen(false)} loading={createMutation.isPending} />
        {createMutation.isError && <p className="mt-2 text-sm text-danger">Failed to create event. Check your dates and try again.</p>}
      </Modal>

      <Modal open={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={selectedEvent?.title as string ?? 'Event'} size="sm">
        {selectedEvent && (
          <div className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Type</span><span className="font-medium text-text-primary">{(selectedEvent.eventType as string).replace('_',' ')}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Starts</span><span className="font-medium text-text-primary">{format(new Date(selectedEvent.startsAt as string),'PPP p')}</span></div>
              {!!(selectedEvent.endsAt as string) && <div className="flex justify-between"><span className="text-text-secondary">Ends</span><span className="font-medium text-text-primary">{format(new Date(selectedEvent.endsAt as string),'PPP p')}</span></div>}
              {!!(selectedEvent.location as string) && <div className="flex justify-between"><span className="text-text-secondary">Location</span><span className="font-medium text-text-primary">{selectedEvent.location as string}</span></div>}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(selectedEvent.id as string)} loading={deleteMutation.isPending}>Delete event</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
