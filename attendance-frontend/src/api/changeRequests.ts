import { api } from './client'
import type { ChangeRequest, CRStatus, CRAction, Paginated } from '@/types/api'

export interface CRParams { status?: CRStatus | ''; action?: CRAction | ''; page?: number; page_size?: number; sort?: string }
export const listRequests = (params: CRParams) => api.get<Paginated<ChangeRequest>>('/change-requests', { params }).then((r) => r.data)
export const listMyRequests = (params: CRParams) => api.get<Paginated<ChangeRequest>>('/change-requests/me', { params }).then((r) => r.data)
export const getRequest = (id: string) => api.get<ChangeRequest>(`/change-requests/${id}`).then((r) => r.data)
export const createRequest = (b: { action: 'add' | 'edit' | 'delete'; session_id?: string; entry_time?: string | null; exit_time?: string | null; reason: string }) => api.post<ChangeRequest>('/change-requests', b).then((r) => r.data)
export const withdrawRequest = (id: string) => api.post<ChangeRequest>(`/change-requests/${id}/cancel`).then((r) => r.data)
export const approveRequest = (id: string, note?: string) => api.post<ChangeRequest>(`/change-requests/${id}/approve`, { note }).then((r) => r.data)
export const rejectRequest = (id: string, note: string) => api.post<ChangeRequest>(`/change-requests/${id}/reject`, { note }).then((r) => r.data)
