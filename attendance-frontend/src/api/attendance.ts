import { api } from './client'
import type { AttendanceRecord, DateFormat, Paginated, Source } from '@/types/api'

export interface AttendanceParams {
  employee?: string; from_date?: string; to_date?: string
  page?: number; page_size?: number;
}
export const listAttendance = (params: AttendanceParams) => api.get<Paginated<AttendanceRecord>>('/attendance', { params }).then((r) => r.data)
export const getMyAttendance = (params: { from_date?: string; to_date?: string; page?: number; page_size?: number }) => api.get<Paginated<AttendanceRecord>>('/attendance/me', { params }).then((r) => r.data)
export const getAttendance = (id: string) => api.get<AttendanceRecord>(`/attendance/${id}`).then((r) => r.data)
export const createAttendance = (b: { employee: string; entry_time: string; exit_time?: string | null; note?: string }) => api.post<AttendanceRecord>('/attendance/manual', b).then((r) => r.data)
export const checkIn = () => api.post<AttendanceRecord>('/attendance/check-in').then((r) => r.data)
export const checkOut = () => api.post<AttendanceRecord>('/attendance/check-out').then((r) => r.data)
export const getStatus = () => api.get<{ checked_in: boolean; session: AttendanceRecord | null }>('/attendance/status').then((r) => r.data)
export const updateAttendance = (id: string, b: { entry_time?: string; exit_time?: string | null; note?: string; version: number }) => api.patch<AttendanceRecord>(`/attendance/${id}`, b).then((r) => r.data)
export const removeAttendance = (id: string) => api.delete(`/attendance/${id}`).then((r) => r.data)
export const restoreAttendance = (id: string) => api.post<AttendanceRecord>(`/attendance/${id}/restore`).then((r) => r.data)
