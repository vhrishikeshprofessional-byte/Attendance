import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as authApi from '@/api/auth'
import { useAuth, useIsAdmin } from '@/auth/AuthContext'
import { usePrefs } from '@/auth/prefs'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { FormError, MIN_PASSWORD, PasswordRules } from '@/features/auth/AuthLayout'
import { applyFieldErrors, parseApiError } from '@/lib/errors'
import { fmtDate, istToday } from '@/lib/time'
import type { DateFormat } from '@/types/api'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2>{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/* ---------- Change password ---------- */

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    new_password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
  .refine((v) => v.new_password !== v.current_password, { path: ['new_password'], message: 'Use a password different from the current one.' })
type PasswordValues = z.infer<typeof passwordSchema>

function ChangePasswordSection() {
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm: '' },
  })
  const newPassword = watch('new_password') ?? ''

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await authApi.changePassword({ current_password: v.current_password, new_password: v.new_password })
      reset()
      toast.success('Password updated.')
    } catch (e) {
      const p = parseApiError(e)
      if (applyFieldErrors(p, setError)) return
      if (p.kind === 'auth' || p.kind === 'validation') setError('current_password', { type: 'server', message: 'Current password is incorrect.' })
      else setFormError(p.message)
    }
  })

  return (
    <Section title="Change password" description="Choose a new password for your account.">
      <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
        {formError && <FormError>{formError}</FormError>}
        <Field label="Current password" htmlFor="cp-current" required error={errors.current_password?.message}>
          <Input id="cp-current" type="password" autoComplete="current-password" invalid={!!errors.current_password} {...register('current_password')} />
        </Field>
        <Field label="New password" htmlFor="cp-new" required error={errors.new_password?.message}>
          <Input id="cp-new" type="password" autoComplete="new-password" invalid={!!errors.new_password} {...register('new_password')} />
        </Field>
        <PasswordRules value={newPassword} />
        <Field label="Confirm new password" htmlFor="cp-confirm" required error={errors.confirm?.message}>
          <Input id="cp-confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" loading={isSubmitting}>Update password</Button>
      </form>
    </Section>
  )
}

/* ---------- Admin credentials ---------- */

const adminSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    email: z.string().trim(),
    new_password: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.email && !z.string().email().safeParse(v.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address.' })
    }
    if (v.new_password && v.new_password.length < MIN_PASSWORD) {
      ctx.addIssue({ code: 'custom', path: ['new_password'], message: `Use at least ${MIN_PASSWORD} characters.` })
    }
    if (v.new_password !== v.confirm) {
      ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'Passwords do not match.' })
    }
  })
type AdminValues = z.infer<typeof adminSchema>

function AdminCredentialsSection() {
  const toast = useToast()
  const { user, setUser } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = useForm<AdminValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { current_password: '', email: '', new_password: '', confirm: '' },
  })
  const newPassword = watch('new_password') ?? ''

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    if (!v.email && !v.new_password) {
      setFormError('Enter a new email, a new password, or both.')
      return
    }
    try {
      await authApi.adminCredentials({
        current_password: v.current_password,
        ...(v.email ? { email: v.email } : {}),
        ...(v.new_password ? { new_password: v.new_password } : {}),
      })
      reset()
      toast.success('Admin credentials updated.')
      try { setUser(await authApi.me()) } catch { /* the next page load refreshes the user */ }
    } catch (e) {
      const p = parseApiError(e)
      if (applyFieldErrors(p, setError)) return
      if (p.kind === 'auth' || p.kind === 'validation') setError('current_password', { type: 'server', message: 'Current password is incorrect.' })
      else if (p.kind === 'conflict') setError('email', { type: 'server', message: 'This email is already in use.' })
      else setFormError(p.message)
    }
  })

  return (
    <Section title="Admin credentials" description={`Change the admin sign-in email or password. Current email: ${user?.work_email ?? '-'}.`}>
      <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
        {formError && <FormError>{formError}</FormError>}
        <Field label="Current password" htmlFor="ac-current" required error={errors.current_password?.message}>
          <Input id="ac-current" type="password" autoComplete="current-password" invalid={!!errors.current_password} {...register('current_password')} />
        </Field>
        <Field label="New email" htmlFor="ac-email" error={errors.email?.message} hint="Leave empty to keep the current email.">
          <Input id="ac-email" type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="New password" htmlFor="ac-new" error={errors.new_password?.message} hint="Leave empty to keep the current password.">
          <Input id="ac-new" type="password" autoComplete="new-password" invalid={!!errors.new_password} {...register('new_password')} />
        </Field>
        {newPassword && <PasswordRules value={newPassword} />}
        <Field label="Confirm new password" htmlFor="ac-confirm" error={errors.confirm?.message}>
          <Input id="ac-confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" loading={isSubmitting}>Save credentials</Button>
      </form>
    </Section>
  )
}

/* ---------- Date format ---------- */

const FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'long', label: 'Long' },
  { value: 'numeric', label: 'Numeric' },
]

function DateFormatSection() {
  const { dateFormat, setDateFormat } = usePrefs()
  const today = istToday()
  return (
    <Section title="Date format" description="How dates and times are shown across the app. Times are always in IST.">
      <fieldset>
        <legend className="sr-only">Date format</legend>
        <div className="space-y-2">
          {FORMATS.map((f) => (
            <label key={f.value} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="date-format"
                value={f.value}
                checked={dateFormat === f.value}
                onChange={() => setDateFormat(f.value)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="font-medium text-gray-900">{f.label}</span>
              <span className="tabular-nums text-gray-600">e.g. {fmtDate(today, f.value)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  )
}

export function SettingsPage() {
  const isAdmin = useIsAdmin()
  return (
    <div className="space-y-4">
      <h1>Settings</h1>
      <DateFormatSection />
      <ChangePasswordSection />
      {isAdmin && <AdminCredentialsSection />}
    </div>
  )
}
