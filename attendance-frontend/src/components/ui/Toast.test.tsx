import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Demo() {
  const t = useToast()
  return (
    <>
      <button onClick={() => t.success('Saved!')}>ok</button>
      <button onClick={() => t.error('Boom')}>err</button>
      <button onClick={() => { for (let i = 1; i <= 6; i++) t.info(`msg ${i}`) }}>many</button>
    </>
  )
}
const setup = () => render(<ToastProvider><Demo /></ToastProvider>)

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a status toast and auto-dismisses after 4s', () => {
    setup()
    fireEvent.click(screen.getByText('ok'))
    expect(screen.getByRole('status')).toHaveTextContent('Saved!')
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })
  it('errors use role=alert and stay for 7s', () => {
    setup()
    fireEvent.click(screen.getByText('err'))
    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.getByText('Boom')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })
  it('can be dismissed manually', () => {
    setup()
    fireEvent.click(screen.getByText('ok'))
    fireEvent.click(screen.getByLabelText('Dismiss notification'))
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })
  it('keeps at most four toasts', () => {
    setup()
    fireEvent.click(screen.getByText('many'))
    expect(screen.queryByText('msg 1')).not.toBeInTheDocument()
    expect(screen.queryByText('msg 2')).not.toBeInTheDocument()
    expect(screen.getByText('msg 6')).toBeInTheDocument()
  })
  it('useToast throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = (e: ErrorEvent) => e.preventDefault()
    window.addEventListener('error', handler)
    expect(() => renderHook(() => useToast())).toThrow(/outside ToastProvider/)
    window.removeEventListener('error', handler)
    spy.mockRestore()
  })
})
