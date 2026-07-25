import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, className = '', id, ...props }, ref) => {
    const inputId = id ?? props.name

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-9 rounded-md border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            ${error ? 'border-danger' : 'border-border-strong'} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
