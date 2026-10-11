import { describe, expect, it } from 'vitest'
import { csvEscape, toCsv } from './csv'

describe('csv', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
  it('renders null/undefined as empty and numbers as text', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
    expect(csvEscape(0)).toBe('0')
  })
  it('builds header + rows', () => {
    expect(toCsv(['Name', 'Hours'], [['Asha, R', 5.5], ['Bo', null]])).toBe('Name,Hours\n"Asha, R",5.5\nBo,')
  })
})
