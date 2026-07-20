import { SelectHTMLAttributes, TextareaHTMLAttributes, InputHTMLAttributes, forwardRef } from 'react'

// ── Select ───────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, label, className = '', id, children, ...props }, ref) => {
    const selectId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={selectId} className="text-sm font-medium text-text-primary">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          className={`h-9 rounded-md border bg-surface px-3 text-sm text-text-primary
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            ${error ? 'border-danger' : 'border-border-strong'} ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'

// ── Textarea ─────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, label, className = '', id, ...props }, ref) => {
    const textareaId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={textareaId} className="text-sm font-medium text-text-primary">{label}</label>}
        <textarea
          ref={ref}
          id={textareaId}
          className={`rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none
            ${error ? 'border-danger' : 'border-border-strong'} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ── Checkbox ─────────────────────────────────────────────────

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 rounded border-border-strong text-primary focus:ring-2 focus:ring-primary/30 ${className}`}
      {...props}
    />
  )
)
Checkbox.displayName = 'Checkbox'
