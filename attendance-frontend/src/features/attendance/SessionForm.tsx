import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Input'
import { DateTimeInput } from '@/components/shared/DateTimeInput'
import { EmployeeSelect } from '@/components/shared/EmployeeSelect'
import { validateSession } from '@/lib/time'

const NOTE_MAX = 500

export interface SessionValues {
  /** Only set when `withEmployee` is true (admin "Add entry"). */
  employee_id?: string
  /** ISO 8601 with the IST offset. */
  entry_time: string
  /** ISO 8601 with the IST offset, or null for an open session. */
  exit_time: string | null
  /** Trimmed note; empty string when blank. */
  note: string
}

export interface SessionFormProps {
  /** Show the employee picker (admin adding an entry for someone). */
  withEmployee?: boolean
  initial?: { employee_id?: string; entry_time?: string; exit_time?: string | null; note?: string | null }
  submitLabel: string
  loading?: boolean
  /** Server-side error (for example a 409 overlap) shown above the buttons. */
  error?: string
  onSubmit: (values: SessionValues) => void
  onCancel: () => void
}

/** Entry/exit form shared by "Add manual entry" (employee) and "Add entry" / "Edit" (admin). Validation mirrors the backend. */
export function SessionForm({ withEmployee = false, initial, submitLabel, loading = false, error, onSubmit, onCancel }: SessionFormProps) {
  const [employeeIds, setEmployeeIds] = useState<string[]>(initial?.employee_id ? [initial.employee_id] : [])
  const [entry, setEntry] = useState(initial?.entry_time ?? '')
  const [exit, setExit] = useState(initial?.exit_time ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [submitted, setSubmitted] = useState(false)

  const employeeError = withEmployee && employeeIds.length === 0 ? 'Select an employee.' : undefined
  let entryError: string | undefined
  let exitError: string | undefined
  if (!entry) {
    entryError = 'Enter an entry date and time.'
  } else {
    const msg = validateSession(entry, exit || null)
    if (msg) {
      if (msg.startsWith('Entry') || msg.includes('valid entry')) entryError = msg
      else exitError = msg
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (employeeError || entryError || exitError) return
    onSubmit({
      employee_id: withEmployee ? employeeIds[0] : undefined,
      entry_time: entry,
      exit_time: exit || null,
      note: note.trim(),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {withEmployee && (
        <Field label="Employee" htmlFor="session-employee" required error={submitted ? employeeError : undefined}>
          <EmployeeSelect id="session-employee" value={employeeIds} onChange={setEmployeeIds} invalid={submitted && !!employeeError} />
        </Field>
      )}
      <DateTimeInput label="Entry" id="session-entry" value={entry} onChange={setEntry} required error={submitted ? entryError : undefined} />
      <DateTimeInput
        label="Exit"
        id="session-exit"
        value={exit}
        onChange={setExit}
        error={submitted ? exitError : undefined}
        hint="Leave empty to record an open session."
      />
      <Field label="Note" htmlFor="session-note" hint={`${note.length}/${NOTE_MAX}`}>
        <Textarea id="session-note" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  )
}

interface SessionDialogProps extends Omit<SessionFormProps, 'onCancel'> {
  open: boolean
  onClose: () => void
  title: string
  description?: string
}

/** Dialog around SessionForm. The form mounts only while the dialog is open, so it resets on every open. */
export function SessionDialog({ open, onClose, title, description, ...form }: SessionDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="md" locked={form.loading}>
      <SessionForm {...form} onCancel={onClose} />
    </Dialog>
  )
}
