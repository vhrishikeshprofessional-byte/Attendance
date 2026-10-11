import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))
import { useAuth } from '@/auth/AuthContext'

const login = vi.fn()
const auth = (over = {}) => vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, login, ...over } as never)
const httpError = (status: number, message = 'x') =>
  new AxiosError('x', String(status), undefined, null, { status, data: { error: { code: 'C', message } }, headers: {}, statusText: '', config: {} as never })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>DASH</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const fill = (id: string, pw: string) => {
  fireEvent.change(screen.getByLabelText('Work email or employee ID'), { target: { value: id } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: pw } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); auth() })

  it('validates required fields', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your work email or employee ID.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
  it('submits trimmed identifier and password', async () => {
    login.mockResolvedValue({})
    renderPage()
    fill('  a@kxn.com ', 'Secret12345')
    await waitFor(() => expect(login).toHaveBeenCalledWith('a@kxn.com', 'Secret12345'))
  })
  it('shows a generic message for bad credentials', async () => {
    login.mockRejectedValue(httpError(401))
    renderPage()
    fill('a@kxn.com', 'wrong')
    expect(await screen.findByText(/Invalid credentials\. Check your email/)).toBeInTheDocument()
  })
  it('shows the server message for lockouts / rate limits', async () => {
    login.mockRejectedValue(httpError(429))
    renderPage()
    fill('a@kxn.com', 'x')
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument()
  })
  it('shows a network error', async () => {
    login.mockRejectedValue(new AxiosError('Network Error'))
    renderPage()
    fill('a@kxn.com', 'x')
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument()
  })
  it('redirects when already signed in', () => {
    auth({ user: { id: '1' } })
    renderPage()
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })
  it('shows a spinner while restoring the session', () => {
    auth({ loading: true })
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
  it('links to signup and forgot-password', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
  })
})
