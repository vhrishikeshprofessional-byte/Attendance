import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { EmptyState, ErrorState, SkeletonRows } from './States'
import type { Pagination } from '@/types/api'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Backend sort field. When set, the header becomes a sort button. */
  sortKey?: string
  align?: 'left' | 'right'
  /** Extra classes for both the header and body cells (e.g. widths). */
  className?: string
}

interface DataTableProps<T> {
  /** Accessible table name (screen readers only). */
  caption: string
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  /** Current sort in backend format: "field" ascending, "-field" descending. */
  sort?: string
  onSortChange?: (sort: string) => void
  pagination?: Pagination
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  /** Makes rows clickable. Clicks on buttons, links and inputs inside a row are ignored. */
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
}

const PAGE_SIZES = [10, 25, 50, 100]
const INTERACTIVE = 'a,button,input,select,textarea,label,[role="button"]'

function nextSort(current: string | undefined, key: string): string {
  if (current === key) return `-${key}`
  if (current === `-${key}`) return ''
  return key
}

export function DataTable<T>({
  caption, columns, rows, rowKey, loading = false, error, onRetry,
  emptyTitle = 'Nothing to show', emptyDescription, emptyAction,
  sort, onSortChange, pagination, onPageChange, onPageSizeChange, onRowClick, rowClassName,
}: DataTableProps<T>) {
  const colSpan = columns.length
  const showSkeleton = loading && !rows?.length
  const showError = !!error && !rows?.length
  const showEmpty = !loading && !error && rows !== undefined && rows.length === 0

  const sortState = (c: Column<T>): 'ascending' | 'descending' | 'none' | undefined => {
    if (!c.sortKey) return undefined
    if (sort === c.sortKey) return 'ascending'
    if (sort === `-${c.sortKey}`) return 'descending'
    return 'none'
  }

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.page_size)) : 1
  const from = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.page_size + 1 : 0
  const to = pagination ? Math.min(pagination.total, pagination.page * pagination.page_size) : 0

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
            <tr>
              {columns.map((c) => {
                const state = sortState(c)
                const Icon = state === 'ascending' ? ArrowUp : state === 'descending' ? ArrowDown : ArrowUpDown
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={state}
                    className={cn('px-4 py-2.5', c.align === 'right' && 'text-right', c.className)}
                  >
                    {c.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(nextSort(sort, c.sortKey!))}
                        className={cn('inline-flex items-center gap-1 rounded hover:text-gray-900', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        <Icon className={cn('h-3.5 w-3.5', state === 'none' && 'text-gray-400')} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton && <SkeletonRows rows={5} cols={colSpan} />}
            {showError && (
              <tr><td colSpan={colSpan}><ErrorState error={error} onRetry={onRetry} /></td></tr>
            )}
            {showEmpty && (
              <tr><td colSpan={colSpan}><EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} /></td></tr>
            )}
            {!showSkeleton && !showError && rows?.map((row) => (
              <tr
                key={rowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest(INTERACTIVE)) onRowClick(row) } : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row) } : undefined}
                className={cn('border-t border-gray-100', onRowClick && 'cursor-pointer hover:bg-gray-50', loading && 'opacity-60', rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-top text-gray-900', c.align === 'right' && 'text-right', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
          <p aria-live="polite">{pagination.total === 0 ? 'No results' : `Showing ${from}-${to} of ${pagination.total}`}</p>
          <div className="flex flex-wrap items-center gap-3">
            {onPageSizeChange && (
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Rows</span>
                <Select
                  value={pagination.page_size}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-8 w-20 text-xs"
                  aria-label="Rows per page"
                >
                  {(PAGE_SIZES.includes(pagination.page_size) ? PAGE_SIZES : [...PAGE_SIZES, pagination.page_size].sort((a, b) => a - b)).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </label>
            )}
            {onPageChange && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <span className="tabular-nums">Page {pagination.page} of {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= totalPages} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
