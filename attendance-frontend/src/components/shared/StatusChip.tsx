import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ChipStatus =
  | 'compliant' | 'non_compliant' | 'in_progress' | 'not_applicable'
  | 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'cancelled'
  | 'open' | 'completed' | 'active' | 'inactive' | 'deleted'

const CHIPS: Record<ChipStatus, { label: string; cls: string }> = {
  compliant: { label: 'Compliant', cls: 'bg-green-50 text-green-700 ring-green-600/20' },
  non_compliant: { label: 'Non-compliant', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  in_progress: { label: 'In progress', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  not_applicable: { label: 'N/A', cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  approved: { label: 'Approved', cls: 'bg-green-50 text-green-700 ring-green-600/20' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  cancelled: { label: 'Cancelled', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  open: { label: 'Open', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 ring-green-600/20' },
  active: { label: 'Active', cls: 'bg-green-50 text-green-700 ring-green-600/20' },
  inactive: { label: 'Inactive', cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  deleted: { label: 'Deleted', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
}

/** Status pill. Always shows text, so meaning never depends on color alone. */
export function StatusChip({ status, label, className }: { status: ChipStatus; label?: string; className?: string }) {
  const c = CHIPS[status]
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', c.cls, className)}>
      {label ?? c.label}
    </span>
  )
}

/** Small neutral chip, e.g. for failed conditions ("Days", "Hours") or team names. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700', className)}>
      {children}
    </span>
  )
}
