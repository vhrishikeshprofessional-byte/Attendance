import { describe, expect, it } from 'vitest'
import { formatDuration, formatInstant, parseTimeInput, periodRange, toIstIso, to12h, validateSession, weekStartOf } from './time'

describe('time', () => {
  it('formats an instant in IST, long and numeric', () => {
    expect(formatInstant('2026-10-09T12:56:56Z')).toBe('October 9, 2026 6:26:56 PM')
    expect(formatInstant('2026-10-09T12:56:56Z', 'numeric')).toBe('10-09-2026 18:26:56')
  })
  it('parses 12h and 24h time input', () => {
    expect(parseTimeInput('6:26 PM')).toBe('18:26:00')
    expect(parseTimeInput('6:26:56 pm')).toBe('18:26:56')
    expect(parseTimeInput('12:00 AM')).toBe('00:00:00')
    expect(parseTimeInput('18:26')).toBe('18:26:00')
    expect(parseTimeInput('25:00')).toBeNull()
    expect(parseTimeInput('13:00 PM')).toBeNull()
  })
  it('builds ISO with the IST offset', () => {
    expect(toIstIso('2026-10-09', '18:26:56')).toBe('2026-10-09T18:26:56+05:30')
    expect(toIstIso('2026-10-09', '18:26')).toBe('2026-10-09T18:26:00+05:30')
    expect(to12h('18:26:00')).toBe('6:26 PM')
  })
  it('finds Monday and period ranges', () => {
    expect(weekStartOf('2026-10-09')).toBe('2026-10-05')
    expect(periodRange('weekly', '2026-10-09')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(periodRange('monthly', '2026-10-09')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('validates sessions like the backend', () => {
    const now = new Date('2026-10-09T13:00:00Z')
    expect(validateSession('2026-10-09T10:00:00+05:30', '2026-10-09T12:00:00+05:30', now)).toBeNull()
    expect(validateSession('2026-10-09T12:00:00+05:30', '2026-10-09T10:00:00+05:30', now)).toMatch(/after entry/)
    expect(validateSession('2026-10-09T20:00:00+05:30', null, now)).toMatch(/future/)
    expect(validateSession('2026-10-08T23:00:00+05:30', '2026-10-09T01:00:00+05:30', now)).toMatch(/midnight/)
    expect(validateSession('2026-10-09T00:30:00+05:30', '2026-10-09T17:30:00+05:30', now)).toMatch(/16 hours/)
  })
  it('formats durations', () => {
    expect(formatDuration(null)).toBe('-')
    expect(formatDuration(3720)).toBe('1h 02m')
    expect(formatDuration(900)).toBe('15m')
  })
})
