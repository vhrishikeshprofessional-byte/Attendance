import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDuration, intervalToDuration } from 'date-fns'
import { Clock, Play, Square } from 'lucide-react'
import { checkIn, checkOut, getStatus } from '@/api/attendance'
import { getMyDailyReport, getMyWeeklyReport } from '@/api/reports'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

function Timer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const update = () => {
      const start = new Date(startTime)
      const now = new Date()
      const duration = intervalToDuration({ start, end: now })
      
      const parts = []
      if (duration.hours) parts.push(`${duration.hours}h`)
      if (duration.minutes) parts.push(`${duration.minutes}m`)
      parts.push(`${duration.seconds || 0}s`)
      
      setElapsed(parts.join(' '))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  return <span className="font-mono tabular-nums">{elapsed}</span>
}

export function EmployeeDashboard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['attendance', 'status'],
    queryFn: getStatus,
    refetchInterval: 60000,
  })

  const { data: dailyReport } = useQuery({
    queryKey: ['reports', 'daily', 'me'],
    queryFn: () => getMyDailyReport(),
  })

  const { data: weeklyReport } = useQuery({
    queryKey: ['reports', 'weekly', 'me'],
    queryFn: () => getMyWeeklyReport(),
  })

  const checkInMut = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      toast.success('Checked in successfully')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Failed to check in')
  })

  const checkOutMut = useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      toast.success('Checked out successfully')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Failed to check out')
  })

  const isCheckedIn = status?.checked_in
  const currentSession = status?.session

  const todayData = dailyReport?.days?.[dailyReport.days.length - 1]
  const currentWeek = weeklyReport?.weeks?.[weeklyReport.weeks.length - 1]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="col-span-full lg:col-span-1 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" />
          Current Status
        </h2>
        
        <div className="mt-6 flex flex-col items-center justify-center space-y-4 py-4">
          <div className="text-4xl font-semibold text-gray-900 tracking-tight">
            {isCheckedIn && currentSession ? (
              <Timer startTime={currentSession.entry_time_iso} />
            ) : (
              <span className="text-gray-400">0h 0m 0s</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-500">
            {isCheckedIn ? 'Currently working' : 'Not checked in'}
          </p>

          <div className="pt-4">
            {!isCheckedIn ? (
              <Button 
                className="w-48 bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95" 
                onClick={() => checkInMut.mutate()}
                loading={checkInMut.isPending || statusLoading}
              >
                <Play className="mr-2 h-5 w-5" />
                Check In
              </Button>
            ) : (
              <Button 
                variant="danger"
                className="w-48 shadow-md transition-all active:scale-95" 
                onClick={() => checkOutMut.mutate()}
                loading={checkOutMut.isPending || statusLoading}
              >
                <Square className="mr-2 h-5 w-5" />
                Check Out
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900">Today's Summary</h2>
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-end border-b border-gray-100 pb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Time</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{todayData?.hours || 0} <span className="text-base font-normal text-gray-500">hrs</span></p>
            </div>
          </div>
          <div className="flex justify-between items-end pb-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Sessions</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{todayData?.sessions || 0}</p>
            </div>
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${todayData?.attended ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {todayData?.attended ? 'Attended' : 'Not Attended'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900">This Week</h2>
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-end border-b border-gray-100 pb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Hours</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{currentWeek?.total_hours || 0} <span className="text-base font-normal text-gray-500">/ {currentWeek?.required_hours || 0} hrs</span></p>
            </div>
          </div>
          <div className="flex justify-between items-end pb-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Days Attended</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{currentWeek?.attended_days || 0} <span className="text-base font-normal text-gray-500">/ {currentWeek?.required_days || 0} days</span></p>
            </div>
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                currentWeek?.status === 'compliant' ? 'bg-green-100 text-green-800' : 
                currentWeek?.status === 'non_compliant' ? 'bg-red-100 text-red-800' : 
                'bg-blue-100 text-blue-800'
              }`}>
                {currentWeek?.status === 'compliant' ? 'Compliant' : 
                 currentWeek?.status === 'non_compliant' ? 'Non-Compliant' : 'In Progress'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
