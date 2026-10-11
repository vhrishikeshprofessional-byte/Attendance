import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMyWeeklyReport } from '@/api/reports'
import { CalendarDays, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

export function MyReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'weekly', 'me'],
    queryFn: () => getMyWeeklyReport(),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading reports...</div>
  
  const weeks = data?.weeks || []
  const summary = data?.summary || { completed_weeks: 0, compliant_weeks: 0, non_compliant_weeks: 0 }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Attendance Reports</h1>
        <p className="mt-1 text-sm text-gray-500">View your weekly compliance and attendance history.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Completed Weeks</p>
            <p className="text-2xl font-semibold text-gray-900">{summary.completed_weeks}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Compliant Weeks</p>
            <p className="text-2xl font-semibold text-gray-900">{summary.compliant_weeks}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Non-Compliant</p>
            <p className="text-2xl font-semibold text-gray-900">{summary.non_compliant_weeks}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Weekly Breakdown</h2>
        </div>
        
        {weeks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No data available for the selected period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Week Start</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Days Attended</th>
                  <th className="px-6 py-4 font-medium">Total Hours</th>
                  <th className="px-6 py-4 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weeks.map((week: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {new Date(week.week_start).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        week.status === 'compliant' ? 'bg-green-100 text-green-800' : 
                        week.status === 'non_compliant' ? 'bg-red-100 text-red-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {week.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {week.attended_days} / {week.required_days}
                    </td>
                    <td className="px-6 py-4">
                      {week.total_hours} / {week.required_hours}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {week.failed_conditions?.length > 0 ? (
                        <span className="text-red-600">Missed: {week.failed_conditions.join(', ')}</span>
                      ) : (
                        <span className="text-green-600">All conditions met</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
