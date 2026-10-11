// The ONLY place that parses or formats dates. Everything displays in IST.
import { addDays, addMonths, addYears, format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import type { DateFormat } from '@/types/api'

export const TZ = 'Asia/Kolkata'
export const IST_OFFSET = '+05:30'
export const MAX_SESSION_HOURS = 16
export const FUTURE_TOLERANCE_SECONDS = 60
const D = 'yyyy-MM-dd'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function formatInstant(iso: string | null | undefined, kind: DateFormat = 'long'): string {
  if (!iso) return ''
  return formatInTimeZone(new Date(iso), TZ, kind === 'long' ? 'MMMM d, yyyy h:mm:ss a' : 'MM-dd-yyyy HH:mm:ss')
}
export const formatClock = (iso: string | null | undefined) => (iso ? formatInTimeZone(new Date(iso), TZ, 'h:mm a') : '')
export const istDateOf = (iso: string) => formatInTimeZone(new Date(iso), TZ, D)
export const istToday = () => formatInTimeZone(new Date(), TZ, D)
/** "now" as ISO 8601 with the IST offset. */
export const istNowIso = (d: Date = new Date()) => formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx")
export const istTimeOf = (iso: string) => formatInTimeZone(new Date(iso), TZ, 'HH:mm:ss')

const toLocal = (s: string) => parse(s, D, new Date(2000, 0, 1))
export const fmtDate = (s: string, kind: DateFormat = 'long') => (s ? format(toLocal(s), kind === 'long' ? 'MMMM d, yyyy' : 'MM-dd-yyyy') : '')
/** Dates from reports may already be display strings ("October 9, 2026"); only format real ISO dates. */
export const displayDate = (s: string, kind: DateFormat = 'long') => (ISO_DATE.test(s) ? fmtDate(s, kind) : s)
export const isIsoDate = (s: string) => ISO_DATE.test(s)
export const fmtDow = (s: string) => format(toLocal(s), 'EEEE')
export const fmtShort = (s: string) => format(toLocal(s), 'MMM d')
export const isWeekend = (s: string) => [0, 6].includes(toLocal(s).getDay())
export const shiftDate = (s: string, unit: 'day' | 'week' | 'month' | 'year', n: number) => {
  const d = toLocal(s)
  return format(unit === 'day' ? addDays(d, n) : unit === 'week' ? addDays(d, 7 * n) : unit === 'month' ? addMonths(d, n) : addYears(d, n), D)
}
export const weekStartOf = (s: string) => {
  const d = toLocal(s)
  return format(addDays(d, -((d.getDay() + 6) % 7)), D)
}
export const weekEndOf = (s: string) => shiftDate(weekStartOf(s), 'day', 6)
export const isMonday = (s: string) => toLocal(s).getDay() === 1
export const yearOf = (s: string) => Number(s.slice(0, 4))

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export const PERIODS: Period[] = ['daily', 'weekly', 'monthly', 'yearly', 'custom']
export function periodRange(period: Period, date: string): { from: string; to: string } {
  const d = toLocal(date)
  switch (period) {
    case 'daily': return { from: date, to: date }
    case 'weekly': return { from: weekStartOf(date), to: weekEndOf(date) }
    case 'monthly': return { from: format(startOfMonth(d), D), to: format(endOfMonth(d), D) }
    case 'yearly': return { from: format(startOfYear(d), D), to: format(endOfYear(d), D) }
    default: return { from: date, to: date }
  }
}
export const periodUnit = (p: Period) => (p === 'daily' ? 'day' : p === 'weekly' ? 'week' : p === 'monthly' ? 'month' : 'year') as 'day' | 'week' | 'month' | 'year'
export const daysBetween = (from: string, to: string) => Math.round((toLocal(to).getTime() - toLocal(from).getTime()) / 86_400_000) + 1
/** Inclusive list of ISO dates (capped to protect the UI). */
export function eachDate(from: string, to: string, cap = 400): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < cap; d = shiftDate(d, 'day', 1)) out.push(d)
  return out
}
/** Month grid, Monday first. Cells are ISO dates or null for padding. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(year, month0, 1)
  const offset = (first.getDay() + 6) % 7
  const count = new Date(year, month0 + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let d = 1; d <= count; d++) cells.push(format(new Date(year, month0, d), D))
  while (cells.length % 7) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}
export const monthLabel = (month0: number) => format(new Date(2000, month0, 1), 'MMMM')

/** Combine an IST date (yyyy-MM-dd) and a 24h time (HH:mm[:ss]) into ISO 8601 with offset. */
export function toIstIso(date: string, time24: string): string {
  const t = time24.length === 5 ? `${time24}:00` : time24
  return `${date}T${t}${IST_OFFSET}`
}

/** Parse "6:26 PM", "6:26:56 pm", "18:26" or "18:26:56" to "HH:mm:ss". Returns null if invalid. */
export function parseTimeInput(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP][mM])?$/)
  if (!m) return null
  let h = Number(m[1]); const min = Number(m[2]); const s = Number(m[3] ?? 0)
  const mer = m[4]?.toLowerCase()
  if (min > 59 || s > 59) return null
  if (mer) { if (h < 1 || h > 12) return null; h = (h % 12) + (mer === 'pm' ? 12 : 0) } else if (h > 23) return null
  return [h, min, s].map((n) => String(n).padStart(2, '0')).join(':')
}
export const to12h = (time24: string) => {
  const [h, m, s] = time24.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Mirrors backend rules: exit after entry, same IST date, no future time, max 16 h. */
export function validateSession(entryIso: string, exitIso: string | null, now = new Date()): string | null {
  const entry = new Date(entryIso)
  if (Number.isNaN(entry.getTime())) return 'Enter a valid entry time.'
  if (entry.getTime() > now.getTime() + FUTURE_TOLERANCE_SECONDS * 1000) return 'Entry time cannot be in the future.'
  if (!exitIso) return null
  const exit = new Date(exitIso)
  if (Number.isNaN(exit.getTime())) return 'Enter a valid exit time.'
  if (exit <= entry) return 'Exit time must be after entry time.'
  if (istDateOf(entryIso) !== istDateOf(exitIso)) return 'A session cannot cross midnight. Add two sessions instead.'
  if (exit.getTime() > now.getTime() + FUTURE_TOLERANCE_SECONDS * 1000) return 'Exit time cannot be in the future.'
  if ((exit.getTime() - entry.getTime()) / 3_600_000 > MAX_SESSION_HOURS) return `A session can be at most ${MAX_SESSION_HOURS} hours.`
  return null
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '-'
  const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
export const formatHours = (h: number) => `${Math.round(h * 100) / 100} h`
