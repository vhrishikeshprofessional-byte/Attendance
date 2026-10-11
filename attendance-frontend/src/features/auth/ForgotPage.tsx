import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import * as authApi from '@/api/auth'
import { parseApiError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { AuthLayout, FormError } from './AuthLayout'

const schema = z.object({ email: z.string().trim().min(1, 'Enter your work email.').email('Enter a valid email address.') })
type FormValues = z.infer<typeof schema>

export function ForgotPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await authApi.forgotPassword(v.email)
      setSentTo(v.email)
    } catch (e) {
      const p = parseApiError(e)
      // The backend answers generically on purpose; only real transport or rate-limit problems are shown.
      if (p.kind === 'network' || p.kind === 'ratelimit' || p.kind === 'server') setFormError(p.message)
      else setSentTo(v.email)
    }
  })

  const back = <Link to="/login" className="font-medium text-indigo-600 hover:underline">Back to sign in</Link>

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={back}>
        <p className="flex items-start gap-2 text-sm text-gray-700">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
          <span>If an account exists for <strong className="font-semibold text-gray-900">{sentTo}</strong>, an email with a reset link has been sent.</span>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your work email and we will send you a reset link." footer={back}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormError>{formError}</FormError>}
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus invalid={!!errors.email} {...register('email')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
    </AuthLayout>
  )
}
