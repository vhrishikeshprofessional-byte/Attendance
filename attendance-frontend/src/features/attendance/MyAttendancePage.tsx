import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LogIn, LogOut, Plus } from 'lucide-react'
import { usePrefs } from '@/auth/prefs'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { FilterBar, FilterField } from '@/components/shared/FilterBar'
import { EmptyState, ErrorState, PageSpinner } from '@/components/shared/States'
import { Chip, StatusChip } from '@/components/shared/StatusChip'
import { useMyAttendanceList, useCheckIn, useCheckOut, useCreateAttendance } from '@/hooks/useAttendance'
import { parseApiError } from '@/lib/errors'
import { displayDate, eachDate, fmtDow, formatDuration, isIsoDate, isWeekend, istToday, periodRange } from '@/lib/time'
import type { AttendanceRecord, Source } from '@/types/api'
import { AttendanceAddRequestDialog, AttendanceDeleteRequestDialog, AttendanceEditRequestDialog } from '@/features/requests/RequestDialogs'

const PAGE_SIZE = 100
const MAX_EMPTY_DAY_RANGE = 62
const SOURCE_LABEL: Record<Source, string> = { check_in: 'Check-in', manual: 'Manual', admin: 'Admin' }
const COLUMNS = ['Date', 'Entry time', 'Exit time', 'Duration', 'Source', 'Status', 'Actions']

type Row =
  | { kind: 'day'; date: string; total: number }
  | { kind: 'empty'; date: string }
  | { kind: 'rec'; rec: AttendanceRecord }

/** Ticks every second while `active`, for the live elapsed timer. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

const clock = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds))
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

export function MyAttendancePage() {
  const [params, setParams] = useSearchParams()
  const { dateFormat } = usePrefs()
  const toast = useToast()
  const today = istToday()
  const def = periodRange('weekly', today)
  const from = params.get('from') ?? def.from
  const to = params.get('to') ?? def.to
  const source = (params.get('source') ?? '') as Source | ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const update = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
      if (!('page' in patch)) next.delete('page')
      return next
    }, { replace: true })

  const list = useMyAttendanceList({ from_date: from, to_date: to, page, page_size: PAGE_SIZE })
  const todayList = useMyAttendanceList({ from_date: today, to_date: today, page_size: 50 })
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const create = useCreateAttendance()

  const [manualOpen, setManualOpen] = useState(false)
  const [editRec, setEditRec] = useState<AttendanceRecord | null>(null)
  const [deleteRec, setDeleteRec] = useState<AttendanceRecord | null>(null)

  const openSession = todayList.data?.items.find((r) => r.open && !r.is_deleted) ?? list.data?.items.find((r) => r.open && !r.is_deleted)
  const now = useNow(!!openSession)
  const elapsed = openSession ? (now - new Date(openSession.entry_time_iso).getTime()) / 1000 : 0

  const doCheck = async (kind: 'in' | 'out') => {
    try {
      if (kind === 'in') await checkIn.mutateAsync()
      else await checkOut.mutateAsync()
      toast.success(kind === 'in' ? 'Checked in.' : 'Checked out.')
    } catch (e) {
      toast.error(parseApiError(e).message)
    }
  }

  const total = list.data?.meta.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const rows = useMemo<Row[]>(() => {
    const records = (list.data?.items ?? []).filter((r) => !r.is_deleted)
    const byDate = new Map<string, AttendanceRecord[]>()
    for (const r of records) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])
    const dates = new Set(byDate.keys())
    // Empty days are only reliable when every record in the range is on this page and no source filter hides some.
    const complete = !!list.data && total <= PAGE_SIZE && !source && from <= to
    if (complete) {
      for (const d of eachDate(from, to, MAX_EMPTY_DAY_RANGE)) if (d <= today && !isWeekend(d)) dates.add(d)
    }
    const out: Row[] = []
    for (const d of [...dates].sort().reverse()) {
      const recs = (byDate.get(d) ?? []).sort((a, b) => a.entry_time_iso.localeCompare(b.entry_time_iso))
      if (!recs.length) { out.push({ kind: 'empty', date: d }); continue }
      out.push({ kind: 'day', date: d, total: recs.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) })
      recs.forEach((rec) => out.push({ kind: 'rec', rec }))
    }
    return out
  }, [list.data, total, source, from, to, today])

  const dayLabel = (d: string) => (isIsoDate(d) ? `${fmtDow(d)}, ${displayDate(d, dateFormat)}` : d)
  const createError = create.error != null ? parseApiError(create.error).message : undefined
  const hasFilters = source !== '' || from !== def.from || to !== def.to

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>My attendance</h1>
        <div className="flex flex-wrap items-center gap-2">
          {openSession && (
            <span className="text-sm tabular-nums text-gray-700" aria-live="off">
              Checked in for <strong className="font-semibold text-gray-900">{clock(elapsed)}</strong>
            </span>
          )}
          {openSession ? (
            <Button onClick={() => doCheck('out')} loading={checkOut.isPending}><LogOut className="h-4 w-4" aria-hidden /> Check out</Button>
          ) : (
            <Button onClick={() => doCheck('in')} loading={checkIn.isPending} disabled={todayList.isLoading}><LogIn className="h-4 w-4" aria-hidden /> Check in</Button>
          )}
          <Button variant="secondary" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add manual entry</Button>
        </div>
      </div>

      <FilterBar hasActiveFilters={hasFilters} onClear={() => setParams({}, { replace: true })}>
        <DateRangePicker from={from} to={to} idPrefix="my-att" onChange={(r) => update({ from: r.from, to: r.to })} />
        <FilterField label="Source" htmlFor="my-att-source">
          <Select id="my-att-source" value={source} onChange={(e) => update({ source: e.target.value })} className="w-40">
            <option value="">All sources</option>
            <option value="check_in">Check-in</option>
            <option value="manual">Manual</option>
            <option value="admin">Admin</option>
          </Select>
        </FilterField>
      </FilterBar>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {list.isLoading ? (
          <PageSpinner />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No attendance in this range" description="Check in, add a manual entry, or pick a different date range." />
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full min-w-max border-collapse text-left text-sm ${list.isFetching ? 'opacity-60' : ''}`}>
              <caption className="sr-only">My attendance sessions grouped by day</caption>
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                <tr>{COLUMNS.map((c) => <th key={c} scope="col" className="px-4 py-2.5">{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  if (row.kind === 'day') {
                    return (
                      <tr key={`day-${row.date}`} className="border-t border-gray-200 bg-gray-50">
                        <th scope="rowgroup" colSpan={COLUMNS.length} className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                          {dayLabel(row.date)} <span className="ml-2 font-normal text-gray-600">Day total: {formatDuration(row.total)}</span>
                        </th>
                      </tr>
                    )
                  }
                  if (row.kind === 'empty') {
                    return (
                      <tr key={`empty-${row.date}`} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-900">{displayDate(row.date, dateFormat)}</td>
                        <td colSpan={COLUMNS.length - 1} className="px-4 py-3 text-gray-600">Not attended office</td>
                      </tr>
                    )
                  }
                  const r = row.rec
                  return (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 align-top text-gray-900">{displayDate(r.date, dateFormat)}</td>
                      <td className="px-4 py-3 align-top tabular-nums text-gray-900">{r.entry_time}</td>
                      <td className="px-4 py-3 align-top tabular-nums text-gray-900">
                        {r.open || !r.exit_time ? <Chip className="bg-blue-50 text-blue-700">Open</Chip> : r.exit_time}
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums text-gray-900">{formatDuration(r.duration_seconds)}</td>
                      <td className="px-4 py-3 align-top text-gray-900">{SOURCE_LABEL[r.source]}</td>
                      <td className="px-4 py-3 align-top"><StatusChip status={r.open ? 'open' : 'completed'} /></td>
                      <td className="px-4 py-3 align-top">
                        {r.pending_request ? (
                          <StatusChip status="pending" label="Pending request" />
                        ) : (
                          <Fragment>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setEditRec(r)}>Request edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteRec(r)}>Request delete</Button>
                            </div>
                          </Fragment>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
            <p aria-live="polite">Page {page} of {totalPages} ({total} sessions). Days with no sessions are hidden when a range has more than {PAGE_SIZE} sessions.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <AttendanceAddRequestDialog open={manualOpen} onClose={() => setManualOpen(false)} />
      <AttendanceEditRequestDialog record={editRec} onClose={() => setEditRec(null)} />
      <AttendanceDeleteRequestDialog record={deleteRec} onClose={() => setDeleteRec(null)} />
    </div>
  )
}
