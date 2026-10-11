import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/holidays'
import { invalidate } from '@/lib/queryClient'

export function useHolidays(year: number, enabled = true) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.listHolidays(year),
    enabled,
  })
}

// A holiday changes the weekly requirement, so reports and dashboards refresh too.
const AFTER = ['holidays', 'report', 'dashboard'] as const

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof api.createHoliday>[0]) => api.createHoliday(body),
    onSuccess: () => invalidate(qc, ...AFTER),
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateHoliday>[1] }) => api.updateHoliday(id, body),
    onSuccess: () => invalidate(qc, ...AFTER),
  })
}

export function useRemoveHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.removeHoliday(id),
    onSuccess: () => invalidate(qc, ...AFTER),
  })
}
