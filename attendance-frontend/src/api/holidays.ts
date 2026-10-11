import { api } from './client'
import type { Holiday } from '@/types/api'

export const listHolidays = (year: number) => api.get<{ items: Holiday[] } | Holiday[]>('/holidays', { params: { year } }).then((r) => (Array.isArray(r.data) ? r.data : r.data.items))
export const createHoliday = (b: { date: string; name: string }) => api.post<Holiday>('/holidays', b).then((r) => r.data)
export const updateHoliday = (id: string, b: { date?: string; name?: string }) => api.patch<Holiday>(`/holidays/${id}`, b).then((r) => r.data)
export const removeHoliday = (id: string) => api.delete(`/holidays/${id}`).then((r) => r.data)
