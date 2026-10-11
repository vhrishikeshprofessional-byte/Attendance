import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { DateTimeInput } from '@/components/shared/DateTimeInput'
import { ReasonDialog } from '@/components/shared/ReasonDialog'
import { useCreateRequest } from '@/hooks/useRequests'
import { parseApiError } from '@/lib/errors'
import { validateSession } from '@/lib/time'
import type { AttendanceRecord } from '@/types/api'

const MAX = 1000
const sameInstant = (a: string | null, b: string | null) => (a && b ? new Date(a).getTime() === new Date(b).getTime() : a === b)

function requestError(e: unknown): string {
  const p = parseApiError(e)
  return p.kind === 'conflict' ? 'This record already has a pending request. Withdraw it first or wait for a decision.' : p.message
}

function EditForm({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  const toast = useToast()
  const create = useCreateRequest()
  const [entry, setEntry] = useState(record.entry_time_iso)
  const [exit, setExit] = useState(record.exit_time_iso ?? '')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const entryChanged = !sameInstant(entry, record.entry_time_iso)
  const exitChanged = !sameInstant(exit || null, record.exit_time_iso)
  const nothingChanged = !entryChanged && !exitChanged

  let entryError: string | undefined
  let exitError: string | undefined
  if (!entry) entryError = 'Enter an entry date and time.'
  else {
    const msg = validateSession(entry, exit || null)
    if (msg) { if (msg.startsWith('Entry') || msg.includes('valid entry')) entryError = msg; else exitError = msg }
  }
  const reasonError = !reason.trim() ? 'Reason is required.' : undefined
  const changeError = nothingChanged ? 'Change the entry or exit time before sending.' : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (entryError || exitError || reasonError || changeError) return
    const proposed: Record<string, unknown> = {}
    if (entryChanged) proposed.entry_time = entry
    if (exitChanged) proposed.exit_time = exit || null
    try {
      await create.mutateAsync({ action: 'edit', session_id: record.id, entry_time: proposed.entry_time as string | undefined, exit_time: proposed.exit_time as string | undefined, reason: reason.trim() })
      toast.success('Edit request sent for review.')
      onClose()
    } catch { /* shown below */ }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm">
        <dt className="text-gray-600">Current entry</dt>
        <dd className="tabular-nums text-gray-900">{record.entry_time}</dd>
        <dt className="text-gray-600">Current exit</dt>
        <dd className="tabular-nums text-gray-900">{record.open || !record.exit_time ? 'Open (no exit yet)' : record.exit_time}</dd>
      </dl>
      <DateTimeInput label="New entry" id="req-entry" value={entry} onChange={setEntry} required error={submitted ? entryError : undefined} />
      <DateTimeInput label="New exit" id="req-exit" value={exit} onChange={setExit} error={submitted ? exitError : undefined} hint="Leave empty to keep the session open." />
      <Field label="Reason" htmlFor="req-reason" required error={submitted ? reasonError : undefined} hint={`${reason.length}/${MAX}`}>
        <Textarea id="req-reason" value={reason} maxLength={MAX} invalid={submitted && !!reasonError} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {submitted && changeError && <p role="alert" className="text-xs font-medium text-red-600">{changeError}</p>}
      {create.error != null && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{requestError(create.error)}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
        <Button type="submit" loading={create.isPending}>Send request</Button>
      </div>
    </form>
  )
}

/** Employee asks an admin to change the entry or exit time of one attendance record. Open with a record, close with null. */
export function AttendanceEditRequestDialog({ record, onClose }: { record: AttendanceRecord | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!record}
      onClose={onClose}
      title="Request an edit"
      description="An admin reviews the change before it is applied."
      size="md"
    >
      {record && <EditForm record={record} onClose={onClose} />}
    </Dialog>
  )
}

/** Employee asks an admin to delete one attendance record (reason only). */
export function AttendanceDeleteRequestDialog({ record, onClose }: { record: AttendanceRecord | null; onClose: () => void }) {
  const toast = useToast()
  const create = useCreateRequest()
  const close = () => { create.reset(); onClose() }

  return (
    <ReasonDialog
      open={!!record}
      title="Request deletion"
      description={record ? `Session starting ${record.entry_time}. An admin reviews the request before anything is removed.` : undefined}
      submitLabel="Send request"
      destructive
      loading={create.isPending}
      error={create.error != null ? requestError(create.error) : undefined}
      onClose={close}
      onSubmit={async (reason) => {
        if (!record) return
        try {
          await create.mutateAsync({ action: 'delete', session_id: record.id, reason })
          toast.success('Delete request sent for review.')
          close()
        } catch { /* shown in the dialog */ }
      }}
    />
  )
}

export function AttendanceAddRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const create = useCreateRequest()
  const [entry, setEntry] = useState('')
  const [exit, setExit] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  let entryError: string | undefined
  let exitError: string | undefined
  if (!entry) entryError = 'Enter an entry date and time.'
  else {
    const msg = validateSession(entry, exit || null)
    if (msg) { if (msg.startsWith('Entry') || msg.includes('valid entry')) entryError = msg; else exitError = msg }
  }
  const reasonError = !reason.trim() ? 'Reason is required.' : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (entryError || exitError || reasonError) return
    try {
      await create.mutateAsync({ action: 'add', entry_time: entry, exit_time: exit || null, reason: reason.trim() })
      toast.success('Add request sent for review.')
      onClose()
    } catch { /* shown below */ }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Request a manual entry" description="An admin reviews the new session before it is added." size="md">
      <form onSubmit={submit} noValidate className="space-y-4">
        <DateTimeInput label="Entry time" id="req-add-entry" value={entry} onChange={setEntry} required error={submitted ? entryError : undefined} />
        <DateTimeInput label="Exit time" id="req-add-exit" value={exit} onChange={setExit} error={submitted ? exitError : undefined} hint="Leave empty to keep the session open." />
        <Field label="Reason" htmlFor="req-add-reason" required error={submitted ? reasonError : undefined} hint={`${reason.length}/${MAX}`}>
          <Textarea id="req-add-reason" value={reason} maxLength={MAX} invalid={submitted && !!reasonError} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {create.error != null && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{requestError(create.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" loading={create.isPending}>Send request</Button>
        </div>
      </form>
    </Dialog>
  )
}
