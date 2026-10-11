import { useQuery } from '@tanstack/react-query'
import { Users, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { getWeeklyOverview } from '@/api/reports'

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'weekly-overview'],
    queryFn: () => getWeeklyOverview(),
  })

  const totalEmployees = data?.meta?.total || 0
  const items = data?.items || []
  
  const compliant = items.filter((i: any) => i.status === 'compliant').length
  const nonCompliant = items.filter((i: any) => i.status === 'non_compliant').length
  const inProgress = items.filter((i: any) => i.status === 'in_progress').length

  const stats = [
    { name: 'Active Employees', value: totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Compliant This Week', value: compliant, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { name: 'Non-Compliant', value: nonCompliant, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    { name: 'In Progress', value: inProgress, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.name}</p>
              <p className="text-2xl font-semibold text-gray-900">
                {isLoading ? '-' : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900">Recent Compliance Issues</h2>
        </div>
        <div className="p-6">
          {nonCompliant === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No compliance issues reported this week.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.filter((i: any) => i.status === 'non_compliant').slice(0, 5).map((item: any) => (
                <li key={item.employee.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700 font-semibold">
                      {item.employee.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.employee.full_name}</p>
                      <p className="text-xs text-gray-500">{item.employee.employee_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-red-600 font-medium">Non-Compliant</p>
                    <p className="text-xs text-gray-500">
                      {item.failed_conditions?.join(', ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
