import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Rendered in a right-aligned row under the content (buttons). */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Block Esc, backdrop click and the close button (e.g. while a request is running). */
  locked?: boolean
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

/**
 * Modal built on the native <dialog> element: the browser traps focus, handles Esc and
 * restores focus to the opener. Children mount only while open, so forms reset on every open.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', locked = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => { e.preventDefault(); if (!locked) onClose() }}
      onMouseDown={(e) => { if (e.target === ref.current && !locked) onClose() }}
      className={cn('m-auto w-[calc(100%-2rem)] rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl', WIDTH[size])}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">{title}</h2>
              {description && <p id={descId} className="mt-1 text-sm text-gray-600">{description}</p>}
            </div>
            <button type="button" onClick={onClose} disabled={locked} aria-label="Close dialog" className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
