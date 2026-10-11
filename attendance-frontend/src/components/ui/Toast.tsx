import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const Ctx = createContext<ToastApi | null>(null)
const DURATION_MS: Record<ToastKind, number> = { success: 4000, info: 4000, error: 7000 }

const STYLE: Record<ToastKind, { box: string; icon: ReactNode }> = {
  success: { box: 'border-green-200 bg-white text-gray-900', icon: <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden /> },
  error: { box: 'border-red-200 bg-white text-gray-900', icon: <AlertCircle className="h-5 w-5 text-red-600" aria-hidden /> },
  info: { box: 'border-blue-200 bg-white text-gray-900', icon: <Info className="h-5 w-5 text-blue-600" aria-hidden /> },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t !== undefined) { window.clearTimeout(t); timers.current.delete(id) }
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]) // keep at most 4 on screen
    timers.current.set(id, window.setTimeout(() => dismiss(id), DURATION_MS[kind]))
  }, [dismiss])

  useEffect(() => {
    const map = timers.current
    return () => { map.forEach((t) => window.clearTimeout(t)); map.clear() }
  }, [])

  // Stable identity so effects that depend on `toast` do not re-run on every render.
  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 shadow-lg', STYLE[t.kind].box)}
          >
            <span className="mt-0.5 shrink-0">{STYLE[t.kind].icon}</span>
            <p className="min-w-0 flex-1 break-words text-sm">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast outside ToastProvider')
  return v
}
