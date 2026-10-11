import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as authApi from '@/api/auth'
import { applyFieldErrors, parseApiError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { AuthLayout, FormError, MIN_PASSWORD, PasswordRules } from './AuthLayout'

const schema = z
  .object({
    new_password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
type FormValues = z.infer<typeof schema>

export function ResetPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const password = watch('new_password') ?? ''

  const requestNew = <Link to="/forgot-password" className="font-medium text-indigo-600 hover:underline">Request a new reset link</Link>

  if (!token) {
    return (
      <AuthLayout title="Reset link is incomplete" footer={requestNew}>
        <p className="text-sm text-gray-700">This page needs the link from your reset email. Open the link again or request a new one.</p>
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await authApi.resetPassword({ token, new_password: v.new_password })
      toast.success('Password updated. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (e) {
      const p = parseApiError(e)
      if (applyFieldErrors({ ...p, fieldErrors: Object.fromEntries(Object.entries(p.fieldErrors).filter(([k]) => k === 'new_password')) }, setError)) return
      setFormError(p.kind === 'validation' ? 'This reset link is invalid or has expired. Request a new one.' : p.message)
    }
  })

  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/login" className="font-medium text-indigo-600 hover:underline">Back to sign in</Link>}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <FormError>
            {formError} {formError.includes('expired') && requestNew}
          </FormError>
        )}
        <Field label="New password" htmlFor="new_password" error={errors.new_password?.message}>
          <Input id="new_password" type="password" autoComplete="new-password" autoFocus invalid={!!errors.new_password} {...register('new_password')} />
        </Field>
        <PasswordRules value={password} />
        <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthLayout>
  )
}
