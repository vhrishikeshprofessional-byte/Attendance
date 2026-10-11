import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarCheck, CalendarDays, Clock, ClipboardList, LayoutDashboard, ScrollText, ShieldCheck, User, Users, UsersRound } from 'lucide-react'
import { listRequests, listMyRequests } from '@/api/changeRequests'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'

interface NavItem { to: string; label: string; icon: ComponentType<{ className?: string }>; badge?: boolean }

const COMMON_TOP: NavItem[] = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
const EMPLOYEE_ONLY: NavItem[] = [{ to: '/attendance', label: 'My attendance', icon: Clock }]
const COMMON_BOTTOM: NavItem[] = [
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/holidays', label: 'Holidays', icon: CalendarDays },
  { to: '/requests', label: 'Requests', icon: ClipboardList, badge: true },
  { to: '/settings', label: 'Settings', icon: User },
]
const ADMIN: NavItem[] = [
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/teams', label: 'Teams', icon: UsersRound },
  { to: '/attendance-manager', label: 'Attendance manager', icon: CalendarCheck },
  { to: '/audit-log', label: 'Audit log', icon: ScrollText },
]

/** Pending change requests: all of them for an admin, only the user's own for an employee (the API scopes by role). */
function usePendingCount(isAdmin: boolean) {
  return useQuery({
    queryKey: ['requests', { status: 'pending', page_size: 1, badge: true, isAdmin }],
    queryFn: () => isAdmin 
      ? listRequests({ status: 'pending', page_size: 1 })
      : listMyRequests({ status: 'pending', page_size: 1 }),
    select: (r) => r.meta.total,
    refetchInterval: 60_000,
  })
}

function Item({ item, count, onNavigate }: { item: NavItem; count?: number; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
          isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && count ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          {count}
          <span className="sr-only"> pending</span>
        </span>
      ) : null}
    </NavLink>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const pending = usePendingCount(isAdmin)
  const count = pending.data

  const top = isAdmin ? COMMON_TOP : [...COMMON_TOP, ...EMPLOYEE_ONLY]

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-gray-900/45 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform',
          'md:sticky md:top-0 md:h-screen md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full max-md:invisible',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white" aria-hidden>
            <Clock className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold">Attendance</span>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
          {top.map((i) => <Item key={i.to} item={i} count={count} onNavigate={onClose} />)}
          {COMMON_BOTTOM.map((i) => <Item key={i.to} item={i} count={count} onNavigate={onClose} />)}
          {isAdmin && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold text-gray-500">Admin</p>
              {ADMIN.map((i) => <Item key={i.to} item={i} count={count} onNavigate={onClose} />)}
            </>
          )}
        </nav>
      </aside>
    </>
  )
}
