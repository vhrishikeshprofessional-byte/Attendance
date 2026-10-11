import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { PrefsProvider, usePrefs } from './prefs'

const wrapper = ({ children }: { children: ReactNode }) => <PrefsProvider>{children}</PrefsProvider>

describe('prefs', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to long and persists changes', () => {
    const { result } = renderHook(() => usePrefs(), { wrapper })
    expect(result.current.dateFormat).toBe('long')
    act(() => result.current.setDateFormat('numeric'))
    expect(result.current.dateFormat).toBe('numeric')
    expect(localStorage.getItem('attendance.date_format')).toBe('numeric')
  })

  it('restores the saved format and ignores junk values', () => {
    localStorage.setItem('attendance.date_format', 'numeric')
    expect(renderHook(() => usePrefs(), { wrapper }).result.current.dateFormat).toBe('numeric')
    localStorage.setItem('attendance.date_format', 'weird')
    expect(renderHook(() => usePrefs(), { wrapper }).result.current.dateFormat).toBe('long')
  })
})
