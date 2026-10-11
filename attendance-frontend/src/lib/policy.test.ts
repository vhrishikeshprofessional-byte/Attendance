import { describe, expect, it } from 'vitest'
import { isAtRisk, periodStatus, requiredFor } from './policy'
import type { WeekRow } from '@/types/api'

describe('requiredFor (DESIGN.md section 3.2)', () => {
  it.each([
    [0, 3, 15], [1, 3, 15], [2, 3, 15], [3, 2, 10], [4, 1, 5], [5, 0, 0],
  ])('%i holidays -> %i days, %i hours', (h, d, hrs) => {
    expect(requiredFor(h)).toEqual({ days: d, hours: hrs })
  })
})

describe('isAtRisk', () => {
  const base = { attendedDays: 0, totalHours: 0, requiredDays: 3, requiredHours: 15 }
  it('is false when already compliant', () => expect(isAtRisk({ ...base, attendedDays: 3, totalHours: 16, remainingWorkingDays: 0 })).toBe(false))
  it('is true when not enough days remain', () => expect(isAtRisk({ ...base, attendedDays: 1, remainingWorkingDays: 1 })).toBe(true))
  it('is false when still reachable', () => expect(isAtRisk({ ...base, attendedDays: 1, totalHours: 5, remainingWorkingDays: 3 })).toBe(false))
})

describe('periodStatus', () => {
  const w = (status: WeekRow['status']) => ({ status }) as WeekRow
  it('prefers non_compliant, then in_progress', () => {
    expect(periodStatus([w('compliant'), w('non_compliant')])).toBe('non_compliant')
    expect(periodStatus([w('compliant'), w('in_progress')])).toBe('in_progress')
    expect(periodStatus([w('compliant')])).toBe('compliant')
    expect(periodStatus([w('not_applicable')])).toBe('not_applicable')
  })
})
