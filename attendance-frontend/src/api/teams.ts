import { api } from './client'
import type { Team, Paginated } from '@/types/api'

export const listTeams = () => api.get<Paginated<Team>>('/teams', { params: { page_size: 200 } }).then((r) => r.data.items)
export const getTeam = (id: string) => api.get<Team>(`/teams/${id}`).then((r) => r.data)
export const createTeam = (b: { name: string; description?: string }) => api.post<Team>('/teams', b).then((r) => r.data)
export const updateTeam = (id: string, b: { name?: string; description?: string }) => api.patch<Team>(`/teams/${id}`, b).then((r) => r.data)
export const removeTeam = (id: string) => api.delete(`/teams/${id}`).then((r) => r.data)
export const setTeamMembers = (id: string, member_ids: string[]) => api.put<Team>(`/teams/${id}/members`, { member_ids }).then((r) => r.data)
