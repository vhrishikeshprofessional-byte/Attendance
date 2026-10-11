import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/changeRequests'
import { invalidate } from '@/lib/queryClient'

export function useRequestList(params: api.CRParams, enabled = true) {
  return useQuery({
    queryKey: ['requests', params],
    queryFn: () => api.listRequests(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: () => api.getRequest(id as string),
    enabled: !!id,
  })
}

// 'attendance' is refreshed as well so the "Pending request" badge on a row stays accurate.
export function useCreateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof api.createRequest>[0]) => api.createRequest(body),
    onSuccess: () => invalidate(qc, 'requests', 'attendance'),
  })
}

export function useWithdrawRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.withdrawRequest(id),
    onSuccess: () => invalidate(qc, 'requests', 'attendance'),
  })
}

export function useRejectRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => api.rejectRequest(id, comment),
    onSuccess: () => invalidate(qc, 'requests', 'attendance'),
  })
}

/** Approving applies the change, so everything that shows attendance or profile data refreshes. */
export function useApproveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => api.approveRequest(id, comment),
    onSuccess: () => invalidate(qc, 'requests', 'attendance', 'report', 'employees', 'employee', 'me', 'dashboard'),
  })
}
