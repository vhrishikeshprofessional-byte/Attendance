import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { applyFieldErrors, parseApiError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { AuthLayout, FormError, MIN_PASSWORD, PasswordRules } from './AuthLayout'

const schema = z
  .object({
    full_name: z.string().trim().min(1, 'Enter your full name.').max(120, 'Use at most 120 characters.'),
    work_email: z.string().trim().min(1, 'Enter your work email.').email('Enter a valid email address.'),
    password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`),
    confirm: z.string(),
    phone: z.string().trim().max(30, 'Use at most 30 characters.').optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
type FormValues = z.infer<typeof schema>

export function SignupPage() {
  const { user, signup } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const password = watch('password') ?? ''

  if (user) return <Navigate to="/dashboard" replace />

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await signup({ full_name: v.full_name, work_email: v.work_email, password: v.password, ...(v.phone ? { phone: v.phone } : {}) })
    } catch (e) {
      const p = parseApiError(e)
      if (p.kind === 'conflict') { setError('work_email', { type: 'server', message: 'An account with this email may already exist. Try signing in.' }); return }
      if (applyFieldErrors(p, setError)) return
      setFormError(p.kind === 'forbidden' ? 'Sign-up is not allowed for this email domain. Use your company email.' : p.message)
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up with your work email."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormError>{formError}</FormError>}
        <Field label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" autoFocus invalid={!!errors.full_name} {...register('full_name')} />
        </Field>
        <Field label="Work email" htmlFor="work_email" required error={errors.work_email?.message}>
          <Input id="work_email" type="email" autoComplete="email" invalid={!!errors.work_email} {...register('work_email')} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message} hint="Optional.">
          <Input id="phone" type="tel" autoComplete="tel" invalid={!!errors.phone} {...register('phone')} />
        </Field>
        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
        </Field>
        <PasswordRules value={password} />
        <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthLayout>
  )
}
