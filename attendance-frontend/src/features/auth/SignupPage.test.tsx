import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupPage } from './SignupPage'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))
import { useAuth } from '@/auth/AuthContext'

const signup = vi.fn()
const httpError = (status: number, data: unknown = {}) =>
  new AxiosError('x', String(status), undefined, null, { status, data, headers: {}, statusText: '', config: {} as never })

function fill(v: { name?: string; email?: string; pw?: string; confirm?: string }) {
  fireEvent.change(screen.getByLabelText(/^Full name/), { target: { value: v.name ?? 'Asha Rao' } })
  fireEvent.change(screen.getByLabelText(/^Work email/), { target: { value: v.email ?? 'asha@kxn.com' } })
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: v.pw ?? 'StrongPass123' } })
  fireEvent.change(screen.getByLabelText(/^Confirm password/), { target: { value: v.confirm ?? v.pw ?? 'StrongPass123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
}
const renderPage = () => render(<MemoryRouter><SignupPage /></MemoryRouter>)

describe('SignupPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(useAuth).mockReturnValue({ user: null, signup } as never) })

  it('submits without an empty phone', async () => {
    signup.mockResolvedValue({})
    renderPage()
    fill({})
    await waitFor(() => expect(signup).toHaveBeenCalledWith({ full_name: 'Asha Rao', work_email: 'asha@kxn.com', password: 'StrongPass123' }))
  })
  it('requires a 10+ character password', async () => {
    renderPage()
    fill({ pw: 'Short1' })
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument()
    expect(signup).not.toHaveBeenCalled()
  })
  it('requires matching passwords', async () => {
    renderPage()
    fill({ pw: 'StrongPass123', confirm: 'Different12345' })
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })
  it('validates the email format', async () => {
    renderPage()
    fill({ email: 'not-an-email' })
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
  })
  it('maps a 409 to an email field error', async () => {
    signup.mockRejectedValue(httpError(409))
    renderPage()
    fill({})
    expect(await screen.findByText(/may already exist/)).toBeInTheDocument()
  })
  it('maps backend field errors onto the form', async () => {
    signup.mockRejectedValue(httpError(422, { error: { code: 'V', message: 'm', details: [{ loc: ['body', 'password'], message: 'Password must contain a digit' }] } }))
    renderPage()
    fill({})
    expect(await screen.findByText('Password must contain a digit')).toBeInTheDocument()
  })
  it('live password rule turns green after 10 chars', () => {
    renderPage()
    expect(screen.getByText(/At least 10 characters$/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: '1234567890' } })
    expect(screen.getByText(/At least 10 characters \(met\)/)).toBeInTheDocument()
  })
})
