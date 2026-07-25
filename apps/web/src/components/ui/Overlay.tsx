import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

// ── Modal ────────────────────────────────────────────────────

interface ModalProps {
  open:    boolean
  onClose: () => void
  title?:  string
  children:ReactNode
  size?:   'sm' | 'md' | 'lg'
}

const MODAL_SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${MODAL_SIZES[size]} rounded-lg bg-surface shadow-modal`}>
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Drawer ───────────────────────────────────────────────────

interface DrawerProps {
  open:    boolean
  onClose: () => void
  title?:  string
  children:ReactNode
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-y-auto bg-surface shadow-modal">
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm dialog ───────────────────────────────────────────

interface ConfirmDialogProps {
  open:        boolean
  title:       string
  description?:string
  confirmLabel?:string
  variant?:    'default' | 'danger'
  loading?:    boolean
  onConfirm:   () => void
  onCancel:    () => void
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', variant = 'default', loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      {description && <p className="mb-4 text-sm text-text-secondary">{description}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-9 rounded-md border border-border-strong px-4 text-sm font-medium text-text-primary hover:bg-surface-3"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`h-9 rounded-md px-4 text-sm font-medium text-white disabled:opacity-50
            ${variant === 'danger' ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-dark'}`}
        >
          {loading ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
