import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/auth'
import * as api from '@/api/employees'
import { invalidate } from '@/lib/queryClient'

/** The signed-in user's own record (query key ['me']). */
export function useMe(enabled = true) {
  return useQuery({ queryKey: ['me'], queryFn: authApi.me, enabled })
}

export function useEmployeeList(params: api.EmployeeParams, enabled = true) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.listEmployees(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.getEmployee(id as string),
    enabled: !!id,
  })
}

/** Send only changed fields plus the current `version`. */
export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateEmployee>[1] }) => api.updateEmployee(id, body),
    onSuccess: () => invalidate(qc, 'employees', 'employee', 'me', 'report'),
  })
}

export function useRemoveEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.removeEmployee(id),
    onSuccess: () => invalidate(qc, 'employees', 'employee', 'teams', 'report'),
  })
}

