import { describe, expect, it } from 'vitest'
import {
  daysBetween, displayDate, eachDate, fmtDate, fmtDow, formatClock, formatHours, isIsoDate, isMonday, isWeekend,
  monthGrid, parseTimeInput, periodRange, shiftDate, to12h, validateSession, weekEndOf, yearOf, istNowIso, formatDuration,
} from './time'

describe('date helpers', () => {
  it('formats dates in both styles', () => {
    expect(fmtDate('2026-10-09')).toBe('October 9, 2026')
    expect(fmtDate('2026-10-09', 'numeric')).toBe('10-09-2026')
    expect(fmtDate('')).toBe('')
  })
  it('displayDate leaves already formatted strings alone', () => {
    expect(displayDate('October 9, 2026')).toBe('October 9, 2026')
    expect(displayDate('2026-10-09')).toBe('October 9, 2026')
    expect(isIsoDate('2026-10-09')).toBe(true)
    expect(isIsoDate('10-09-2026')).toBe(false)
  })
  it('weekday helpers', () => {
    expect(fmtDow('2026-10-09')).toBe('Friday')
    expect(isWeekend('2026-10-10')).toBe(true)
    expect(isWeekend('2026-10-09')).toBe(false)
    expect(isMonday('2026-10-05')).toBe(true)
    expect(weekEndOf('2026-10-07')).toBe('2026-10-11')
    expect(yearOf('2026-10-09')).toBe(2026)
  })
  it('shifts across units and month ends', () => {
    expect(shiftDate('2026-10-31', 'day', 1)).toBe('2026-11-01')
    expect(shiftDate('2026-10-09', 'week', -1)).toBe('2026-10-02')
    expect(shiftDate('2026-01-31', 'month', 1)).toBe('2026-02-28')
    expect(shiftDate('2028-02-29', 'year', 1)).toBe('2029-02-28')
  })
  it('periodRange covers daily/yearly/custom', () => {
    expect(periodRange('daily', '2026-10-09')).toEqual({ from: '2026-10-09', to: '2026-10-09' })
    expect(periodRange('yearly', '2026-10-09')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('monthly', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(periodRange('custom', '2026-10-09')).toEqual({ from: '2026-10-09', to: '2026-10-09' })
  })
  it('daysBetween and eachDate (with cap)', () => {
    expect(daysBetween('2026-10-05', '2026-10-11')).toBe(7)
    expect(eachDate('2026-10-05', '2026-10-07')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
    expect(eachDate('2026-10-07', '2026-10-05')).toEqual([])
    expect(eachDate('2026-01-01', '2026-12-31', 10)).toHaveLength(10)
  })
  it('monthGrid is Monday-first and padded to full weeks', () => {
    const g = monthGrid(2026, 9) // October 2026 starts on Thursday
    expect(g).toHaveLength(5)
    expect(g.every((r) => r.length === 7)).toBe(true)
    expect(g[0].slice(0, 3)).toEqual([null, null, null])
    expect(g[0][3]).toBe('2026-10-01')
    expect(g.flat().filter(Boolean)).toHaveLength(31)
  })
})

describe('time helpers', () => {
  it('parseTimeInput edge cases', () => {
    expect(parseTimeInput('12:00 PM')).toBe('12:00:00')
    expect(parseTimeInput('12:30 am')).toBe('00:30:00')
    expect(parseTimeInput('0:00 AM')).toBeNull()
    expect(parseTimeInput('9:60')).toBeNull()
    expect(parseTimeInput('9:30:61')).toBeNull()
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput('noon')).toBeNull()
    expect(parseTimeInput('  7:05 pm ')).toBe('19:05:00')
  })
  it('to12h', () => {
    expect(to12h('00:00:00')).toBe('12:00 AM')
    expect(to12h('12:30:00')).toBe('12:30 PM')
    expect(to12h('18:26:56')).toBe('6:26:56 PM')
  })
  it('formatClock / istNowIso / durations', () => {
    expect(formatClock('2026-10-09T12:56:56Z')).toBe('6:26 PM')
    expect(formatClock(null)).toBe('')
    expect(istNowIso(new Date('2026-10-09T12:56:56Z'))).toBe('2026-10-09T18:26:56+05:30')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(3600)).toBe('1h 00m')
    expect(formatHours(5.456)).toBe('5.46 h')
  })
})

describe('validateSession extras', () => {
  const now = new Date('2026-10-09T13:00:00Z')
  it('allows an open session in the past', () => expect(validateSession('2026-10-09T10:00:00+05:30', null, now)).toBeNull())
  it('rejects garbage', () => {
    expect(validateSession('nope', null, now)).toMatch(/valid entry/)
    expect(validateSession('2026-10-09T10:00:00+05:30', 'nope', now)).toMatch(/valid exit/)
  })
  it('exactly 16 hours is accepted', () => expect(validateSession('2026-10-09T01:00:00+05:30', '2026-10-09T17:00:00+05:30', new Date('2026-10-09T13:00:00Z'))).toBeNull())
})
