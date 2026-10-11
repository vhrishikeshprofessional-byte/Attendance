// Types mirror the backend schemas in DESIGN.md. Fields not pinned down by the
// design doc (list envelopes, extra display fields) are marked "assumed".

export type Role = 'admin' | 'employee'
export type UserStatus = 'active' | 'inactive'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export type Source = 'check_in' | 'manual' | 'admin'
export type DateFormat = 'long' | 'numeric'

export interface Address { line1: string; line2?: string; city: string; state: string; postal_code: string; country: string }
export interface EmergencyContact { name: string; relation: string; phone: string }
export interface Personal {
  full_name: string
  date_of_birth?: string | null
  gender?: string | null
  phone?: string | null
  personal_email?: string | null
  address?: Partial<Address> | null
  emergency_contact?: Partial<EmergencyContact> | null
}
export interface Professional {
  designation?: string | null
  department?: string | null
  joining_date?: string | null
  employment_type?: EmploymentType | null
  manager_id?: string | null
  work_location?: string | null
  team_ids?: string[]
}
export interface User {
  id: string
  role: Role
  status: UserStatus
  employee_id: string
  work_email: string
  personal: Personal
  professional: Professional
  age?: number | null // derived, read-only
  is_deleted?: boolean
  version: number
}

export interface Pagination { page: number; page_size: number; total: number }
export interface Paginated<T> { items: T[]; meta: Pagination }

export interface AuthResponse { access_token: string; refresh_token: string; user: User }

export interface Team { id: string; name: string; description?: string | null; member_count?: number; member_ids?: string[] }
export interface Holiday { id: string; date: string; name: string }

export interface EmployeeRef { id?: string; employee_id: string; full_name: string; teams?: string[] }

export interface AttendanceRecord {
  id: string
  employee: EmployeeRef // assumed: embedded for the admin table
  entry_time: string
  entry_time_iso: string
  exit_time: string
  exit_time_iso: string | null
  date: string
  duration_seconds: number | null
  source: Source
  note?: string | null
  open: boolean
  is_deleted?: boolean
  version: number
  pending_request?: boolean // assumed: lets the UI disable "Request edit"
}

export type CRAction = 'add' | 'edit' | 'delete'
export type CRStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'cancelled'
export interface ChangeRequest {
  id: string
  requester: EmployeeRef
  action: CRAction
  target: { type: string; id: string }
  session_id: string | null
  proposed?: Record<string, unknown> | null
  original?: Record<string, unknown> | null
  reason: string
  status: CRStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_comment?: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  ts: string
  actor_id: string
  actor_name?: string
  actor_role: Role
  action: string
  entity: { collection: string; id: string }
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip?: string
}

export type WeekStatus = 'compliant' | 'non_compliant' | 'in_progress' | 'not_applicable'
export type FailedCondition = 'days' | 'hours'
export interface WeekRow {
  week_start: string
  holidays: number
  required_days: number
  required_hours: number
  attended_days: number
  total_hours: number
  days_ok: boolean
  hours_ok: boolean
  status: WeekStatus
  failed_conditions: FailedCondition[]
}
export interface SessionRow { entry_time: string; exit_time: string; open?: boolean }
export interface DayRow {
  date: string
  day_type: 'working' | 'holiday' | 'weekly_off'
  status: 'Attended' | 'Not attended office'
  total_hours: number
  sessions: SessionRow[]
}
export interface ReportEmployeeRow {
  employee: EmployeeRef
  totals: { attended_days: number; total_hours: number; avg_hours_per_attended_day: number }
  weeks: WeekRow[]
  days?: DayRow[]
}
export interface ReportTeamRow { team: { id: string; name: string }; members: number; compliant: number; non_compliant: number; avg_hours: number } // assumed
export interface ReportDayGroupRow { date: string; attended: number; absent: number } // assumed
export interface ReportResponse {
  period: { type: string; from: string; to: string }
  summary: { employees: number; compliant: number; non_compliant: number; in_progress: number }
  data: (ReportEmployeeRow | ReportTeamRow | ReportDayGroupRow)[]
  pagination: Pagination
}

export interface PolicyRunRow { employee: EmployeeRef; week_start: string; failed_conditions: FailedCondition[]; attended_days: number; required_days: number; total_hours: number; required_hours: number }
export interface PolicyRunResponse { dry_run: boolean; week_start: string; would_email?: PolicyRunRow[]; emailed?: number; last_run?: string | null } // assumed

export interface ApiErrorBody { error: { code: string; message: string; details?: unknown } }
