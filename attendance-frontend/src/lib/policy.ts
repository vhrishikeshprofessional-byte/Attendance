// Display hints only (progress bars, at-risk banners). The backend is the source of truth.
import type { DayRow, WeekRow, WeekStatus } from '@/types/api'
import { isIsoDate, isWeekend, shiftDate, weekEndOf } from './time'

export const MAX_DAYS_PER_WEEK = 3
export const HOURS_PER_REQUIRED_DAY = 5

export function requiredFor(holidaysOnWorkingDays: number, workingDays = 5): { days: number; hours: number } {
  const w = Math.max(0, workingDays - holidaysOnWorkingDays)
  const days = Math.min(MAX_DAYS_PER_WEEK, w)
  return { days, hours: HOURS_PER_REQUIRED_DAY * days }
}

/** Rows of the 0..5 holiday table shown on the Policy page. */
export const requirementTable = () =>
  [0, 1, 2, 3, 4, 5].map((h) => ({ holidays: h, workingDays: 5 - h, ...requiredFor(h) }))

/** Can the employee still reach the requirement this week? remainingWorkingDays includes today. */
export function isAtRisk(args: { attendedDays: number; totalHours: number; requiredDays: number; requiredHours: number; remainingWorkingDays: number }): boolean {
  const { attendedDays, totalHours, requiredDays, requiredHours, remainingWorkingDays } = args
  if (attendedDays >= requiredDays && totalHours >= requiredHours) return false
  const daysShort = requiredDays - attendedDays
  const hoursShort = requiredHours - totalHours
  // A session is capped at 16 h, so that is the most one remaining day can add.
  return daysShort > remainingWorkingDays || hoursShort > remainingWorkingDays * 16
}

/** Working days left in the week of `today` (today included). Uses report day rows when they carry ISO dates. */
export function remainingWorkingDays(today: string, days?: DayRow[]): number {
  if (days?.length && days.every((d) => isIsoDate(d.date))) {
    return days.filter((d) => d.date >= today && d.day_type === 'working').length
  }
  let n = 0
  for (let d = today; d <= weekEndOf(today); d = shiftDate(d, 'day', 1)) if (!isWeekend(d)) n++
  return n
}

/** One status for a multi-week period, derived from its week rows (display only). */
export function periodStatus(weeks: WeekRow[]): WeekStatus {
  const applicable = weeks.filter((w) => w.status !== 'not_applicable')
  if (!applicable.length) return 'not_applicable'
  if (applicable.some((w) => w.status === 'non_compliant')) return 'non_compliant'
  if (applicable.some((w) => w.status === 'in_progress')) return 'in_progress'
  return 'compliant'
}
