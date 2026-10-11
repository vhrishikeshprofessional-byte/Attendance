import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/attendance'
import { invalidate } from '@/lib/queryClient'

export function useAttendanceList(params: api.AttendanceParams, enabled = true) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => api.listAttendance(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useMyAttendanceList(params: Parameters<typeof api.getMyAttendance>[0], enabled = true) {
  return useQuery({
    queryKey: ['my-attendance', params],
    queryFn: () => api.getMyAttendance(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useAttendanceRecord(id: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'detail', id],
    queryFn: () => api.getAttendance(id as string),
    enabled: !!id,
  })
}

/** Check-in, check-out and create all change totals, so reports and dashboards refresh too. */
export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.checkIn,
    onSuccess: () => invalidate(qc, 'attendance', 'report', 'dashboard'),
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.checkOut,
    onSuccess: () => invalidate(qc, 'attendance', 'report', 'dashboard'),
  })
}

export function useCreateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof api.createAttendance>[0]) => api.createAttendance(body),
    onSuccess: () => invalidate(qc, 'attendance', 'report', 'dashboard'),
  })
}

/** Admin edit. The body must carry the record's `version`; a 409 means it changed and should be reloaded. */
export function useUpdateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateAttendance>[1] }) => api.updateAttendance(id, body),
    onSuccess: () => invalidate(qc, 'attendance', 'report', 'dashboard'),
  })
}

export function useRemoveAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.removeAttendance(id),
    onSuccess: () => invalidate(qc, 'attendance', 'report', 'dashboard'),
  })
}

export function useRestoreAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.restoreAttendance(id),
    onSuccess: () => invalidate(qc, 'attendance', 'report', 'dashboard'),
  })
}
