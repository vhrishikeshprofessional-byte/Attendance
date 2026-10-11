import type { ReactNode } from 'react'
import { AlertCircle, Inbox, Loader2, ShieldAlert } from 'lucide-react'
import { parseApiError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

/** Spinner for a page or a section. `full` centers it on the whole viewport (used while the session restores). */
export function PageSpinner({ full = false, label = 'Loading' }: { full?: boolean; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center', full ? 'min-h-screen' : 'py-16')} role="status">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Pulsing grey block used to build skeleton rows. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-gray-200', className)} aria-hidden />
}

/** Table skeleton: render inside a <tbody>. */
export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-t border-gray-100">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[10rem]" /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-12 text-center', className)}>
      <Inbox className="h-8 w-8 text-gray-400" aria-hidden />
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/**
 * Error panel. Pass the raw `error` from a query or mutation.
 * 403 shows a "no access" state, 404 a "not found" state, 409 a reload prompt, everything else the parsed message.
 */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const parsed = parseApiError(error)
  const forbidden = parsed.kind === 'forbidden'
  const title = forbidden ? 'No access' : parsed.kind === 'notfound' ? 'Not found' : parsed.kind === 'network' ? 'Cannot reach the server' : 'Something went wrong'
  const retryLabel = parsed.kind === 'conflict' ? 'Reload' : 'Try again'
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-12 text-center', className)} role="alert">
      {forbidden ? <ShieldAlert className="h-8 w-8 text-amber-600" aria-hidden /> : <AlertCircle className="h-8 w-8 text-red-600" aria-hidden />}
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="max-w-sm text-sm text-gray-600">{parsed.message}</p>
      {onRetry && !forbidden && <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">{retryLabel}</Button>}
    </div>
  )
}
