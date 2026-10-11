import { useAuth } from '@/auth/AuthContext'
import { EmployeeDashboard } from './EmployeeDashboard'
import { AdminDashboard } from './AdminDashboard'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome back, {user.personal?.full_name?.split(' ')[0] || 'User'}
      </h1>
      {user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />}
    </div>
  )
}
