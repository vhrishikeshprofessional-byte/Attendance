import { describe, expect, it } from 'vitest'
import { isAtRisk, remainingWorkingDays, requirementTable } from './policy'
import type { DayRow } from '@/types/api'

describe('policy extras', () => {
  it('requirementTable covers 0..5 holidays', () => {
    const t = requirementTable()
    expect(t).toHaveLength(6)
    expect(t[0]).toEqual({ holidays: 0, workingDays: 5, days: 3, hours: 15 })
    expect(t[5]).toEqual({ holidays: 5, workingDays: 0, days: 0, hours: 0 })
  })
  it('requiredFor respects a custom working-day count', async () => {
    const { requiredFor } = await import('./policy')
    expect(requiredFor(0, 4)).toEqual({ days: 3, hours: 15 })
    expect(requiredFor(9, 5)).toEqual({ days: 0, hours: 0 })
  })
  it('remainingWorkingDays counts today through Friday', () => {
    expect(remainingWorkingDays('2026-10-07')).toBe(3) // Wed, Thu, Fri
    expect(remainingWorkingDays('2026-10-05')).toBe(5)
    expect(remainingWorkingDays('2026-10-10')).toBe(0) // Saturday
  })
  it('remainingWorkingDays prefers report day rows (holidays excluded)', () => {
    const days = [
      { date: '2026-10-07', day_type: 'working' }, { date: '2026-10-08', day_type: 'holiday' },
      { date: '2026-10-09', day_type: 'working' }, { date: '2026-10-10', day_type: 'weekly_off' },
    ] as DayRow[]
    expect(remainingWorkingDays('2026-10-07', days)).toBe(2)
  })
  it('isAtRisk by hours', () => {
    const a = { attendedDays: 0, totalHours: 0, requiredDays: 1, requiredHours: 100, remainingWorkingDays: 3 }
    expect(isAtRisk(a)).toBe(true)
    expect(isAtRisk({ ...a, requiredHours: 40 })).toBe(false)
  })
})
