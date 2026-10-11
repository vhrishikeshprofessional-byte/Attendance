import type { ReactNode } from 'react'
import { Check, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Backend password policy (DESIGN.md section 9): minimum 10 characters. */
export const MIN_PASSWORD = 10

/** Centered card used by the public pages (login, signup, forgot and reset password). */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white" aria-hidden>
          <Clock className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold">Attendance</span>
      </div>
      <main className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </main>
      {footer && <div className="mt-4 text-sm text-gray-600">{footer}</div>}
    </div>
  )
}

/** Form-level error (not tied to one field). */
export function FormError({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>
}

/** Live checklist under a password field. Shows a check and text, so it never relies on color alone. */
export function PasswordRules({ value }: { value: string }) {
  const ok = value.length >= MIN_PASSWORD
  return (
    <p className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-green-700' : 'text-gray-600')}>
      {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}
      At least {MIN_PASSWORD} characters{ok ? ' (met)' : ''}
    </p>
  )
}
