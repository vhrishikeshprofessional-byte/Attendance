import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireRole } from '@/auth/RequireRole'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { ForgotPage } from '@/features/auth/ForgotPage'
import { ResetPage } from '@/features/auth/ResetPage'
import { MyAttendancePage } from '@/features/attendance/MyAttendancePage'
import { HolidaysPage } from '@/features/holidays/HolidaysPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { NotFoundPage } from '@/features/common/NotFoundPage'
import { TeamsPage } from '@/features/teams/TeamsPage'
import { TeamDetailPage } from '@/features/teams/TeamDetailPage'
import { RequestsPage } from '@/features/requests/RequestsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { EmployeesPage } from '@/features/employees/EmployeesPage'
import { AttendanceManagerPage } from '@/features/attendance/AttendanceManagerPage'
import { AuditLogPage } from '@/features/audit/AuditLogPage'
import { ProfilePage } from '@/features/profile/ProfilePage'

export const router = createBrowserRouter([
  // Public pages (paths match the links used inside the auth screens).
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPage /> },
  { path: '/reset-password', element: <ResetPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'attendance', element: <MyAttendancePage /> },
          { path: 'holidays', element: <HolidaysPage /> },
          { path: 'requests', element: <RequestsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          // Admin only: other roles are redirected to /dashboard with a toast.
          {
            element: <RequireRole role="admin" />,
            children: [
              { path: 'employees', element: <EmployeesPage /> },
              { path: 'teams', element: <TeamsPage /> },
              { path: 'teams/:id', element: <TeamDetailPage /> },
              { path: 'attendance-manager', element: <AttendanceManagerPage /> },
              { path: 'audit-log', element: <AuditLogPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
