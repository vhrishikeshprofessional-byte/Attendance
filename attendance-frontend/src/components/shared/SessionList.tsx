import { cn } from '@/lib/cn'
import { Chip } from './StatusChip'
import type { SessionRow } from '@/types/api'

interface SessionListProps {
  sessions: SessionRow[]
  className?: string
}

/**
 * Renders "entry to exit" pairs, one per line. Times arrive from the API already formatted
 * (see the date_format parameter), so they are shown as-is. An open session shows an "Open" chip.
 */
export function SessionList({ sessions, className }: SessionListProps) {
  if (!sessions.length) return <span className="text-gray-500">-</span>
  return (
    <ul className={cn('space-y-0.5', className)}>
      {sessions.map((s, i) => (
        <li key={`${s.entry_time}-${i}`} className="flex flex-wrap items-center gap-x-1.5 text-sm tabular-nums text-gray-900">
          <span>{s.entry_time}</span>
          <span className="text-gray-500" aria-hidden>to</span>
          <span className="sr-only">to</span>
          {s.open || !s.exit_time ? <Chip className="bg-blue-50 text-blue-700">Open</Chip> : <span>{s.exit_time}</span>}
        </li>
      ))}
    </ul>
  )
}
