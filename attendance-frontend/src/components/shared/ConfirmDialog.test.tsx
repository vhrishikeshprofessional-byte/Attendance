import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

const props = { title: 'Delete team', message: 'Really delete?', confirmLabel: 'Delete team', onConfirm: vi.fn(), onCancel: vi.fn() }

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    render(<ConfirmDialog {...props} open={false} />)
    expect(screen.queryByText('Really delete?')).not.toBeInTheDocument()
  })
  it('renders title, message and action labels when open', () => {
    render(<ConfirmDialog {...props} open />)
    expect(screen.getByRole('heading', { name: 'Delete team' })).toBeInTheDocument()
    expect(screen.getByText('Really delete?')).toBeInTheDocument()
  })
  it('calls onConfirm / onCancel', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDialog {...props} open onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete team' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
  it('disables buttons while loading', () => {
    render(<ConfirmDialog {...props} open loading />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  })
})
