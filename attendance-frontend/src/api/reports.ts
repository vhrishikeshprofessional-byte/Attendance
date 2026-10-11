import { api } from './client'

export const getMyDailyReport = (params?: { from_date?: string; to_date?: string }) => 
  api.get('/reports/me/daily', { params }).then((r) => r.data)

export const getMyWeeklyReport = (params?: { from_date?: string; to_date?: string }) => 
  api.get('/reports/me/weekly', { params }).then((r) => r.data)

export const getWeeklyOverview = (params?: { week_start?: string; team_id?: string; page?: number; page_size?: number }) => 
  api.get('/reports/weekly-overview', { params }).then((r) => r.data)

export const getBISummary = (params?: { from_date?: string; to_date?: string; team_id?: string }) => 
  api.get('/reports/bi/summary', { params }).then((r) => r.data)

export const getBITrends = (params?: { from_date?: string; to_date?: string; team_id?: string }) => 
  api.get('/reports/bi/trends', { params }).then((r) => r.data)

export const getBITeams = (params?: { from_date?: string; to_date?: string }) => 
  api.get('/reports/bi/teams', { params }).then((r) => r.data)

export const getBIExceptions = (params?: { from_date?: string; to_date?: string; page?: number; page_size?: number }) => 
  api.get('/reports/bi/exceptions', { params }).then((r) => r.data)
