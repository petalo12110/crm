import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Overlay'
import { useSendCustomerEmail } from '../hooks/useCustomers'

export function SendEmailModal({ open, onClose, customerId, customerEmail, customerName }: {
  open: boolean
  onClose: () => void
  customerId: string
  customerEmail: string
  customerName: string
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')
  const sendMutation = useSendCustomerEmail(customerId)

  const handleClose = () => {
    setSubject('')
    setBody('')
    sendMutation.reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Email ${customerName}`}>
      {sendMutation.isSuccess ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="text-sm text-text-primary">Sent to {customerEmail}.</p>
          <p className="text-xs text-text-secondary">Logged to this customer's timeline.</p>
          <Button size="sm" onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">To: <span className="text-text-primary">{customerEmail}</span></p>
          <Input
            label="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="How can we help?"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Message</label>
            <textarea
              rows={7}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>
          {sendMutation.isError && (
            <p className="text-sm text-danger">Couldn't send — check your platform SMTP settings and try again.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              loading={sendMutation.isPending}
              disabled={!subject.trim() || !body.trim()}
              onClick={() => sendMutation.mutate({ subject, body })}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
