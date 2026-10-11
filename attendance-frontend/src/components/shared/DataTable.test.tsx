import { fireEvent, render, screen } from '@testing-library/react'
import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type Column } from './DataTable'

interface Row { id: string; name: string }
const rows: Row[] = [{ id: '1', name: 'Asha' }, { id: '2', name: 'Bo' }]
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortKey: 'name', cell: (r) => r.name },
  { key: 'act', header: 'Actions', cell: (r) => <button>Do {r.name}</button> },
]
const base = { caption: 'People', columns, rows, rowKey: (r: Row) => r.id }

describe('DataTable', () => {
  it('renders rows with an accessible caption', () => {
    render(<DataTable {...base} />)
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByText('Asha')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })
  it('shows the empty state', () => {
    render(<DataTable {...base} rows={[]} emptyTitle="No people" emptyDescription="Add some" />)
    expect(screen.getByText('No people')).toBeInTheDocument()
    expect(screen.getByText('Add some')).toBeInTheDocument()
  })
  it('shows a skeleton while loading with no rows', () => {
    render(<DataTable {...base} rows={undefined} loading />)
    expect(screen.queryByText('Asha')).not.toBeInTheDocument()
    expect(screen.queryByText('No people')).not.toBeInTheDocument()
  })
  it('shows an error with retry', () => {
    const onRetry = vi.fn()
    render(<DataTable {...base} rows={undefined} error={new Error('x')} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })
  it('403 error shows "No access" without retry', () => {
    const err = new AxiosError('x', '403', undefined, null, { status: 403, data: {}, headers: {}, statusText: '', config: {} as never })
    render(<DataTable {...base} rows={undefined} error={err} onRetry={() => {}} />)
    expect(screen.getByText('No access')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
  it('cycles sort asc -> desc -> none and exposes aria-sort', () => {
    const onSortChange = vi.fn()
    const { rerender } = render(<DataTable {...base} sort="" onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSortChange).toHaveBeenLastCalledWith('name')
    rerender(<DataTable {...base} sort="name" onSortChange={onSortChange} />)
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSortChange).toHaveBeenLastCalledWith('-name')
    rerender(<DataTable {...base} sort="-name" onSortChange={onSortChange} />)
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSortChange).toHaveBeenLastCalledWith('')
  })
  it('paginates', () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(<DataTable {...base} pagination={{ page: 1, page_size: 10, total: 25 }} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />)
    expect(screen.getByText('Showing 1-10 of 25')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(onPageChange).toHaveBeenCalledWith(2)
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })
  it('disables Next on the last page and reports empty totals', () => {
    const { rerender } = render(<DataTable {...base} pagination={{ page: 3, page_size: 10, total: 25 }} onPageChange={() => {}} />)
    expect(screen.getByText('Showing 21-25 of 25')).toBeInTheDocument()
    expect(screen.getByLabelText('Next page')).toBeDisabled()
    rerender(<DataTable {...base} rows={[]} pagination={{ page: 1, page_size: 10, total: 0 }} onPageChange={() => {}} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })
  it('row click ignores clicks on inner buttons and supports Enter', () => {
    const onRowClick = vi.fn()
    render(<DataTable {...base} onRowClick={onRowClick} />)
    fireEvent.click(screen.getByText('Asha'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
    onRowClick.mockClear()
    fireEvent.click(screen.getByText('Do Bo'))
    expect(onRowClick).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getAllByRole('row')[2], { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
  })
})
