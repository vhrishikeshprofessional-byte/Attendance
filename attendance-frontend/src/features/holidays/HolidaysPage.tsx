import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useIsAdmin } from '@/auth/AuthContext'
import { usePrefs } from '@/auth/prefs'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterField } from '@/components/shared/FilterBar'
import { Chip } from '@/components/shared/StatusChip'
import { useCreateHoliday, useHolidays, useRemoveHoliday, useUpdateHoliday } from '@/hooks/useHolidays'
import { parseApiError } from '@/lib/errors'
import { displayDate, fmtDow, isIsoDate, isWeekend, istToday, yearOf } from '@/lib/time'
import type { Holiday } from '@/types/api'

const NAME_MAX = 120

function holidayError(e: unknown): string {
  const p = parseApiError(e)
  return p.kind === 'conflict' ? 'A holiday already exists on that date.' : p.message
}

interface HolidayFormProps {
  year: number
  initial?: Holiday
  loading: boolean
  error?: string
  onSubmit: (v: { date: string; name: string }) => void
  onCancel: () => void
}

function HolidayForm({ year, initial, loading, error, onSubmit, onCancel }: HolidayFormProps) {
  const [date, setDate] = useState(initial?.date ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [submitted, setSubmitted] = useState(false)

  const trimmed = name.trim()
  const dateError = !date ? 'Pick a date.' : !isIsoDate(date) ? 'Enter a valid date.' : undefined
  const nameError = !trimmed ? 'Enter a holiday name.' : trimmed.length > NAME_MAX ? `Use at most ${NAME_MAX} characters.` : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (dateError || nameError) return
    onSubmit({ date, name: trimmed })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Date" htmlFor="holiday-date" required error={submitted ? dateError : undefined}>
        <Input
          id="holiday-date"
          type="date"
          value={date}
          min={`${year}-01-01`}
          max={`${year}-12-31`}
          invalid={submitted && !!dateError}
          onChange={(e) => setDate(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label="Name" htmlFor="holiday-name" required error={submitted ? nameError : undefined} hint={`${name.length}/${NAME_MAX}`}>
        <Input id="holiday-name" value={name} maxLength={NAME_MAX} invalid={submitted && !!nameError} onChange={(e) => setName(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{initial ? 'Save changes' : 'Add holiday'}</Button>
      </div>
    </form>
  )
}

/** Holidays for one year. Everyone can read; only the admin can add, edit or delete. */
export function HolidaysPage() {
  const isAdmin = useIsAdmin()
  const { dateFormat } = usePrefs()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const thisYear = yearOf(istToday())
  const year = Number(params.get('year')) || thisYear

  const list = useHolidays(year)
  const create = useCreateHoliday()
  const update = useUpdateHoliday()
  const remove = useRemoveHoliday()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [deleting, setDeleting] = useState<Holiday | null>(null)

  const years = useMemo(() => {
    const set = new Set<number>()
    for (let y = thisYear - 3; y <= thisYear + 2; y++) set.add(y)
    set.add(year)
    return [...set].sort((a, b) => a - b)
  }, [thisYear, year])

  const rows = useMemo(() => [...(list.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [list.data])

  const closeAdd = () => { setAdding(false); create.reset() }
  const closeEdit = () => { setEditing(null); update.reset() }

  const columns: Column<Holiday>[] = [
    { key: 'date', header: 'Date', cell: (h) => <span className="tabular-nums">{displayDate(h.date, dateFormat)}</span> },
    { key: 'name', header: 'Name', cell: (h) => h.name },
    {
      key: 'dow',
      header: 'Day',
      cell: (h) => (
        <span className="flex flex-wrap items-center gap-2">
          {isIsoDate(h.date) ? fmtDow(h.date) : '-'}
          {isIsoDate(h.date) && isWeekend(h.date) && <Chip>Weekend</Chip>}
        </span>
      ),
    },
  ]
  if (isAdmin) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      cell: (h) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`}><Pencil className="h-4 w-4" aria-hidden /> Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(h)} aria-label={`Delete ${h.name}`}><Trash2 className="h-4 w-4" aria-hidden /> Delete</Button>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Holidays</h1>
        {isAdmin && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add holiday</Button>}
      </div>

      <FilterBar>
        <FilterField label="Year" htmlFor="holiday-year">
          <Select
            id="holiday-year"
            value={year}
            onChange={(e) => setParams({ year: e.target.value }, { replace: true })}
            className="w-32"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      <p className="text-sm text-gray-600">Holidays on a Saturday or Sunday do not change the weekly requirement.</p>

      <DataTable
        caption={`Holidays in ${year}`}
        columns={columns}
        rows={list.data ? rows : undefined}
        rowKey={(h) => h.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        emptyTitle={`No holidays in ${year}`}
        emptyDescription={isAdmin ? 'Add a holiday to lower the weekly requirement for that week.' : 'No holidays have been added for this year.'}
      />

      <Dialog open={adding} onClose={closeAdd} title="Add holiday" description="Dates are in IST." size="sm" locked={create.isPending}>
        <HolidayForm
          year={year}
          loading={create.isPending}
          error={create.error != null ? holidayError(create.error) : undefined}
          onCancel={closeAdd}
          onSubmit={async (v) => {
            try {
              await create.mutateAsync(v)
              toast.success('Holiday added.')
              closeAdd()
            } catch { /* shown in the dialog */ }
          }}
        />
      </Dialog>

      <Dialog open={!!editing} onClose={closeEdit} title="Edit holiday" size="sm" locked={update.isPending}>
        {editing && (
          <HolidayForm
            year={year}
            initial={editing}
            loading={update.isPending}
            error={update.error != null ? holidayError(update.error) : undefined}
            onCancel={closeEdit}
            onSubmit={async (v) => {
              const body: { date?: string; name?: string } = {}
              if (v.date !== editing.date) body.date = v.date
              if (v.name !== editing.name) body.name = v.name
              if (!Object.keys(body).length) { closeEdit(); return }
              try {
                await update.mutateAsync({ id: editing.id, body })
                toast.success('Holiday updated.')
                closeEdit()
              } catch { /* shown in the dialog */ }
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete holiday"
        message={deleting ? <>Delete <strong className="font-semibold">{deleting.name}</strong> on {displayDate(deleting.date, dateFormat)}? The weekly requirement for that week will be recalculated.</> : null}
        confirmLabel="Delete holiday"
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success('Holiday deleted.')
            setDeleting(null)
          } catch (e) {
            toast.error(parseApiError(e).message)
          }
        }}
      />
    </div>
  )
}
