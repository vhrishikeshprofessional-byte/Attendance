import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'

interface ReasonDialogProps {
  open: boolean
  title: string
  description?: string
  /** Label above the textarea, e.g. "Reason" or "Comment". */
  label?: string
  submitLabel: string
  /** When false the text may be left empty (e.g. an optional approval comment). Default true. */
  required?: boolean
  destructive?: boolean
  loading?: boolean
  /** Server-side message to show under the text box. */
  error?: string
  /** Extra content shown above the text box (e.g. current values). */
  children?: ReactNode
  onSubmit: (reason: string) => void
  onClose: () => void
}

const MAX = 1000

function ReasonForm({ label, submitLabel, required, destructive, loading, error, children, onSubmit, onClose }: Omit<ReasonDialogProps, 'open' | 'title' | 'description'> & { label: string; required: boolean }) {
  const id = useId()
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = text.trim()
  const missing = required && !trimmed
  const shownError = error ?? (touched && missing ? `${label} is required.` : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!missing) onSubmit(trimmed)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {children}
      <Field label={label} htmlFor={id} required={required} error={shownError} hint={`${text.length}/${MAX}`}>
        <Textarea id={id} value={text} maxLength={MAX} invalid={!!shownError} autoFocus onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" variant={destructive ? 'danger' : 'primary'} loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  )
}

/** Dialog that collects a reason or comment. Used for change requests and for rejecting or approving them. */
export function ReasonDialog({ open, title, description, label = 'Reason', required = true, onClose, loading, ...rest }: ReasonDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="md" locked={loading}>
      <ReasonForm label={label} required={required} loading={loading} onClose={onClose} {...rest} />
    </Dialog>
  )
}
