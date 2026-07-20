import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Select, Textarea } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'

export interface CustomerFormValues {
  firstName?:    string
  lastName?:     string
  email?:        string
  phone?:        string
  companyName?:  string
  industry?:     string
  website?:      string
  status:        string
  customerType:  string
  notes?:        string
}

export function CustomerForm({
  defaultValues, onSubmit, onCancel, loading,
}: {
  defaultValues?: Partial<CustomerFormValues>
  onSubmit: (values: CustomerFormValues) => void
  onCancel: () => void
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    defaultValues: { status: 'ACTIVE', customerType: 'INDIVIDUAL', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last name"  error={errors.lastName?.message}  {...register('lastName')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone" {...register('phone')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Type" {...register('customerType')}>
          <option value="INDIVIDUAL">Individual</option>
          <option value="BUSINESS">Business</option>
        </Select>
        <Select label="Status" {...register('status')}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="PROSPECT">Prospect</option>
          <option value="BLOCKED">Blocked</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Company name" {...register('companyName')} />
        <Input label="Industry"     {...register('industry')} />
      </div>

      <Input label="Website" {...register('website')} />
      <Textarea label="Notes" rows={3} {...register('notes')} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Save customer</Button>
      </div>
    </form>
  )
}
