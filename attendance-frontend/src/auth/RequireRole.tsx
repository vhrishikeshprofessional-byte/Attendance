import { useEffect, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from '@/components/ui/Toast'
import type { Role } from '@/types/api'

export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()
  const toast = useToast()
  const allowed = user?.role === role
  useEffect(() => { if (user && !allowed) toast.error('You do not have access to that page.') }, [user, allowed]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  return user?.role === role ? <>{children}</> : null
}
