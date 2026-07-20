import { useForm } from 'react-hook-form'
import { dateInputToISO } from '@/lib/dates'
import { Input } from '@/components/ui/Input'
import { Select, Textarea } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'

export interface LeadFormValues {
  title:         string
  source?:       string
  campaign?:     string
  value?:        number
  probability?:  number
  expectedClose?:string
  notes?:        string
}

export function LeadForm({
  defaultValues, onSubmit, onCancel, loading,
}: {
  defaultValues?: Partial<LeadFormValues>
  onSubmit: (values: LeadFormValues) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<LeadFormValues>({ defaultValues })

  const handleFormSubmit = (values: LeadFormValues) => {
    onSubmit({ ...values, expectedClose: dateInputToISO(values.expectedClose) })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Title"
        error={errors.title?.message}
        {...register('title', { required: 'Title is required' })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Source" {...register('source')}>
          <option value="">— Select —</option>
          <option value="WEBSITE">Website</option>
          <option value="REFERRAL">Referral</option>
          <option value="COLD_CALL">Cold Call</option>
          <option value="TRADE_FAIR">Trade Fair</option>
        </Select>
        <Input label="Campaign" {...register('campaign')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Value" type="number" {...register('value', { valueAsNumber: true })} />
        <Input label="Probability (%)" type="number" min={0} max={100} {...register('probability', { valueAsNumber: true })} />
      </div>

      <Textarea label="Notes" rows={3} {...register('notes')} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Save lead</Button>
      </div>
    </form>
  )
}
