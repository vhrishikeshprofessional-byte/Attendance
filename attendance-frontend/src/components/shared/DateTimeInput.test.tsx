import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateTimeInput } from './DateTimeInput'

const date = () => document.getElementById('dt-date') as HTMLInputElement
const time = () => screen.getByLabelText('Entry time') as HTMLInputElement

describe('DateTimeInput', () => {
  it('emits "" until both date and time are valid, then IST ISO', () => {
    const onChange = vi.fn()
    render(<DateTimeInput label="Entry" id="dt" value="" onChange={onChange} />)
    fireEvent.change(time(), { target: { value: '6:26 PM' } })
    expect(onChange).toHaveBeenLastCalledWith('')
    fireEvent.change(date(), { target: { value: '2025-01-06' } })
    expect(onChange).toHaveBeenLastCalledWith('2025-01-06T18:26:00+05:30')
  })
  it('accepts 24-hour input with seconds', () => {
    const onChange = vi.fn()
    render(<DateTimeInput label="Entry" id="dt" value="" onChange={onChange} />)
    fireEvent.change(date(), { target: { value: '2025-01-06' } })
    fireEvent.change(time(), { target: { value: '18:26:56' } })
    expect(onChange).toHaveBeenLastCalledWith('2025-01-06T18:26:56+05:30')
  })
  it('splits an incoming ISO value into IST date and 12h time', () => {
    render(<DateTimeInput label="Entry" id="dt" value="2025-01-06T12:56:56Z" onChange={() => {}} />)
    expect(date().value).toBe('2025-01-06')
    expect(time().value).toBe('6:26:56 PM')
  })
  it('shows a hint-friendly error on a bad time after blur', () => {
    render(<DateTimeInput label="Entry" id="dt" value="" onChange={() => {}} />)
    fireEvent.change(time(), { target: { value: 'abc' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.blur(time())
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time like 6:26 PM or 18:26.')
  })
  it('normalises a valid time on blur', () => {
    render(<DateTimeInput label="Entry" id="dt" value="" onChange={() => {}} />)
    fireEvent.change(time(), { target: { value: '18:26' } })
    fireEvent.blur(time())
    expect(time().value).toBe('6:26 PM')
  })
  it('shows an external error and disables inputs', () => {
    render(<DateTimeInput label="Entry" id="dt" value="" onChange={() => {}} error="Entry time cannot be in the future." disabled />)
    expect(screen.getByRole('alert')).toHaveTextContent('Entry time cannot be in the future.')
    expect(time()).toBeDisabled()
    expect(date()).toBeDisabled()
  })
  it('blocks future dates in the picker by default', () => {
    render(<DateTimeInput label="Entry" id="dt" value="" onChange={() => {}} />)
    expect(date().max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
