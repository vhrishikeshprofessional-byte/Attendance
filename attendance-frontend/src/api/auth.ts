import { api } from './client'
import type { AuthResponse, User } from '@/types/api'

export const login = (identifier: string, password: string) => api.post<AuthResponse>('/auth/login', { identifier, password }).then((r) => r.data)
export const signup = (b: { full_name: string; work_email: string; password: string; phone?: string }) =>
  api.post<AuthResponse>('/auth/signup', b).then((r) => r.data)
export const logout = (refresh_token: string | null) => api.post('/auth/logout', { refresh_token }).then((r) => r.data)
export const changePassword = (b: { current_password: string; new_password: string }) => api.post('/auth/change-password', b).then((r) => r.data)
export const forgotPassword = (email: string) => api.post('/auth/forgot-password', { email }).then((r) => r.data)
export const resetPassword = (b: { token: string; new_password: string }) => api.post('/auth/reset-password', b).then((r) => r.data)
export const adminCredentials = (b: { current_password: string; email?: string; new_password?: string }) => api.patch('/auth/admin/credentials', b).then((r) => r.data)
export const me = () => api.get<User>('/auth/me').then((r) => r.data)
