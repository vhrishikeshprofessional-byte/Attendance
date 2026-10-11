import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import { HolidaysPage } from './HolidaysPage'

vi.mock('@/auth/AuthContext', () => ({ useIsAdmin: vi.fn(), useAuth: vi.fn() }))
vi.mock('@/api/holidays', () => ({
  listHolidays: vi.fn(), createHoliday: vi.fn(), updateHoliday: vi.fn(), removeHoliday: vi.fn(),
}))
import { listHolidays } from '@/api/holidays'
import { useIsAdmin } from '@/auth/AuthContext'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider><HolidaysPage /></ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HolidaysPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listHolidays).mockResolvedValue([
      { id: '2', date: '2026-10-20', name: 'Diwali' },
      { id: '1', date: '2026-10-10', name: 'Weekend Fest' }, // Saturday
    ])
  })

  it('lists holidays sorted by date with weekday and weekend chip', async () => {
    vi.mocked(useIsAdmin).mockReturnValue(false)
    renderPage()
    expect(await screen.findByText('Diwali')).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Weekend Fest')
    expect(rows[0]).toHaveTextContent('October 10, 2026')
    expect(rows[0]).toHaveTextContent('Saturday')
    expect(rows[0]).toHaveTextContent('Weekend')
    expect(rows[1]).not.toHaveTextContent('Weekend')
  })

  it('employees get no add/edit/delete controls', async () => {
    vi.mocked(useIsAdmin).mockReturnValue(false)
    renderPage()
    await screen.findByText('Diwali')
    expect(screen.queryByRole('button', { name: /Add holiday/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument()
  })

  it('admins get add/edit/delete controls', async () => {
    vi.mocked(useIsAdmin).mockReturnValue(true)
    renderPage()
    await screen.findByText('Diwali')
    expect(screen.getByRole('button', { name: /Add holiday/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Diwali' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Diwali' })).toBeInTheDocument()
  })

  it('shows role-specific empty text', async () => {
    vi.mocked(listHolidays).mockResolvedValue([])
    vi.mocked(useIsAdmin).mockReturnValue(false)
    renderPage()
    expect(await screen.findByText(/No holidays in \d{4}/)).toBeInTheDocument()
    expect(screen.getByText('No holidays have been added for this year.')).toBeInTheDocument()
  })

  it('shows an error state with a retry button', async () => {
    vi.mocked(listHolidays).mockRejectedValue(new Error('boom'))
    vi.mocked(useIsAdmin).mockReturnValue(false)
    renderPage()
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
