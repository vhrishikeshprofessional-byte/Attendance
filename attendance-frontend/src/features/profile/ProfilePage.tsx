import { useAuth } from '@/auth/AuthContext'
import { Building2, Calendar, Mail, Phone, User as UserIcon } from 'lucide-react'
import { StatusChip } from '@/components/shared/StatusChip'

export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  const p = user.personal
  const pro = user.professional

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Your personal and professional information.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
            <UserIcon className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-medium text-gray-900">Personal Details</h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-base text-gray-900">{p.full_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email Address</dt>
              <dd className="mt-1 flex items-center gap-2 text-base text-gray-900">
                <Mail className="h-4 w-4 text-gray-400" />
                {user.work_email}
              </dd>
            </div>
            {p.phone && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 flex items-center gap-2 text-base text-gray-900">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {p.phone}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-medium text-gray-900">Professional Details</h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
              <dd className="mt-1 text-base font-medium tabular-nums text-gray-900">{user.employee_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role & Status</dt>
              <dd className="mt-1 flex items-center gap-2 text-base text-gray-900 capitalize">
                {user.role} <StatusChip status={user.status} />
              </dd>
            </div>
            {pro.joining_date && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Joining Date</dt>
                <dd className="mt-1 flex items-center gap-2 text-base text-gray-900">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(pro.joining_date).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  )
}
