import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }))
import { useAuth } from './AuthContext'

const setAuth = (v: { user: unknown; loading?: boolean }) =>
  vi.mocked(useAuth).mockReturnValue({ loading: false, ...v } as never)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/dashboard" element={<div>DASH</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/me" element={<div>PRIVATE</div>} />
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin" element={<div>ADMIN</div>} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('route guards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a spinner while the session restores', () => {
    setAuth({ user: null, loading: true })
    renderAt('/me')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument()
  })
  it('redirects anonymous users to /login', () => {
    setAuth({ user: null })
    renderAt('/me')
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
  })
  it('lets signed-in users through', () => {
    setAuth({ user: { role: 'employee' } })
    renderAt('/me')
    expect(screen.getByText('PRIVATE')).toBeInTheDocument()
  })
  it('sends non-admins away from admin pages with a toast', async () => {
    setAuth({ user: { role: 'employee' } })
    renderAt('/admin')
    expect(screen.getByText('DASH')).toBeInTheDocument()
    expect(await screen.findByText('You do not have access to that page.')).toBeInTheDocument()
  })
  it('admins can open admin pages', () => {
    setAuth({ user: { role: 'admin' } })
    renderAt('/admin')
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })
})
