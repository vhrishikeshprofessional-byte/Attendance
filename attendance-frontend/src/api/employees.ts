import { api } from './client'
import type { Paginated, User } from '@/types/api'

export interface EmployeeParams { q?: string; team_id?: string; status?: string; employment_type?: string; include_deleted?: boolean; page?: number; page_size?: number; sort?: string }
export const listEmployees = (params: EmployeeParams) => api.get<Paginated<User>>('/users', { params }).then((r) => r.data)
export const getEmployee = (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data)
export const createEmployee = (body: Record<string, unknown>) => api.post<User>('/users', body).then((r) => r.data)
export const updateEmployee = (id: string, body: Record<string, unknown>) => api.patch<User>(`/users/${id}`, body).then((r) => r.data)
export const removeEmployee = (id: string) => api.delete(`/users/${id}`).then((r) => r.data)
