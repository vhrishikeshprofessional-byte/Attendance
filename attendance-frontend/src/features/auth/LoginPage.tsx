import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { parseApiError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/shared/States'
import { AuthLayout, FormError } from './AuthLayout'

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your work email or employee ID.'),
  password: z.string().min(1, 'Enter your password.'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (loading) return <PageSpinner full />
  if (user) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await login(v.identifier, v.password) // on success `user` is set and the redirect above runs
    } catch (e) {
      const p = parseApiError(e)
      setFormError(p.kind === 'auth' || p.kind === 'validation' ? 'Invalid credentials. Check your email or employee ID and your password.' : p.message)
    }
  })

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your work email or employee ID."
      footer={<>New here? <Link to="/signup" className="font-medium text-indigo-600 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormError>{formError}</FormError>}
        <Field label="Work email or employee ID" htmlFor="identifier" error={errors.identifier?.message}>
          <Input id="identifier" autoComplete="username" autoFocus invalid={!!errors.identifier} {...register('identifier')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
    </AuthLayout>
  )
}
