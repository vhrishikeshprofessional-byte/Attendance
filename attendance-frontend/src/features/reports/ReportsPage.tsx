import { useAuth } from '@/auth/AuthContext'
import { EnterpriseBIDashboard } from './EnterpriseBIDashboard'
import { MyReportsPage } from './MyReportsPage'

export function ReportsPage() {
  const { user } = useAuth()
  if (user?.role === 'admin') {
    return <EnterpriseBIDashboard />
  }
  return <MyReportsPage />
}
