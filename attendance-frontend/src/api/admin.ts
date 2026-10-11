import { api } from './client'
import type { AuditLog, Paginated, PolicyRunResponse } from '@/types/api'

export const runPolicy = (week_start: string, dry_run: boolean) => api.post<PolicyRunResponse>('/admin/policy/run', null, { params: { week_start, dry_run } }).then((r) => r.data)
export interface AuditParams { actor_id?: string; entity_collection?: string; entity_id?: string; action?: string; from?: string; to?: string; page?: number; page_size?: number }
export const listAuditLogs = (params: AuditParams) => api.get<Paginated<AuditLog>>('/audit-logs', { params }).then((r) => r.data)
