import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Pencil, Trash2, UserMinus, UserPlus, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { ErrorState, PageSpinner } from '@/components/shared/States'
import { StatusChip } from '@/components/shared/StatusChip'
import { useEmployeeList } from '@/hooks/useEmployees'
import { useRemoveTeam, useSetTeamMembers, useTeam } from '@/hooks/useTeams'
import { parseApiError } from '@/lib/errors'
import type { Team, User } from '@/types/api'
import { TeamFormDialog } from './TeamFormDialog'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t) }, [value, ms])
  return v
}

function AddMembersForm({ existing, loading, error, onSubmit, onCancel }: {
  existing: string[]
  loading: boolean
  error?: string
  onSubmit: (ids: string[]) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const list = useEmployeeList({ q: q || undefined, page_size: 100 })
  
  const [ids, setIds] = useState<Set<string>>(new Set())
  
  const fresh = Array.from(ids).filter((i) => !existing.includes(i))
  const alreadyIn = Array.from(ids).length - fresh.length

  const toggle = (id: string) => {
    setIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (fresh.length) onSubmit(fresh) }}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          className="pl-9" 
          placeholder="Search employees by name, email or ID..." 
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-50 [&::-webkit-scrollbar-track]:rounded-r-lg [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
        {list.isFetching && !list.data ? (
          <div className="p-8 text-center text-sm text-gray-500">
             <Loader2 className="h-4 w-4 animate-spin inline mr-2 align-text-bottom" /> Searching...
          </div>
        ) : list.data?.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No employees found.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.data?.items.map(u => {
              const inTeam = existing.includes(u.id)
              const selected = inTeam || ids.has(u.id)
              return (
                <li key={u.id}>
                  <label className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${inTeam ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer disabled:cursor-not-allowed" 
                      checked={selected}
                      disabled={inTeam || loading}
                      onChange={() => toggle(u.id)}
                    />
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {u.personal.full_name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{u.personal.full_name}</p>
                      <p className="truncate text-xs text-gray-500 tabular-nums">{u.employee_id} • {u.work_email}</p>
                    </div>
                    {inTeam && <span className="text-xs font-medium text-gray-500">Already in team</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
        <p className="text-sm text-gray-600">
          {fresh.length} selected {alreadyIn > 0 && `(${alreadyIn} skipped)`}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={fresh.length === 0}>
            {fresh.length > 1 ? `Add ${fresh.length} members` : 'Add member'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Admin: one team with its member table. Member changes send the full list through PUT /teams/{id}/members. */
export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const team = useTeam(id)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const members = useEmployeeList({ team_id: id, page, page_size: pageSize }, !!id)
  const setMembers = useSetTeamMembers()
  const removeTeam = useRemoveTeam()

  const [editing, setEditing] = useState<Team | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (team.isLoading) return <PageSpinner />
  if (team.error || !team.data) return <ErrorState error={team.error} onRetry={() => team.refetch()} />
  const t = team.data

  // The PUT replaces the whole list, so only edit when the complete member list is known.
  const total = members.data?.meta.total
  const currentIds: string[] | null =
    t.member_ids ?? (members.data && total !== undefined && total <= members.data.items.length ? members.data.items.map((u) => u.id) : null)
  const canEdit = currentIds !== null

  const closeAdd = () => { setAdding(false); setMembers.reset() }

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', cell: (u) => <span className="font-medium">{u.personal.full_name}</span> },
    { key: 'employee_id', header: 'Employee ID', cell: (u) => <span className="tabular-nums">{u.employee_id}</span> },
    { key: 'email', header: 'Work email', cell: (u) => u.work_email },
    { key: 'status', header: 'Status', cell: (u) => <StatusChip status={u.status === 'active' ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (u) => (
        <Button variant="ghost" size="sm" disabled={!canEdit} onClick={() => setRemoving(u)} aria-label={`Remove ${u.personal.full_name} from team`}>
          <UserMinus className="h-4 w-4" aria-hidden /> Remove
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Link to="/teams" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All teams
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate">{t.name}</h1>
          {t.description && <p className="mt-1 max-w-2xl text-sm text-gray-600">{t.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/reports?team_id=${encodeURIComponent(t.id)}&period=weekly`}
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" aria-hidden /> View team report
          </Link>
          <Button variant="secondary" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" aria-hidden /> Edit</Button>
          <Button variant="secondary" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" aria-hidden /> Delete</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Members{total !== undefined ? ` (${total})` : ''}</h2>
        <Button onClick={() => setAdding(true)} disabled={!canEdit}><UserPlus className="h-4 w-4" aria-hidden /> Add members</Button>
      </div>
      {!canEdit && members.data && (
        <p className="text-sm text-gray-600">This team has more members than one page shows, so editing is paused until the server returns the full member list.</p>
      )}

      <DataTable
        caption={`Members of ${t.name}`}
        columns={columns}
        rows={members.data?.items}
        rowKey={(u) => u.id}
        loading={members.isLoading}
        error={members.error}
        onRetry={() => members.refetch()}
        emptyTitle="No members yet"
        emptyDescription="Add employees to include them in this team's reports."
        pagination={members.data?.meta}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      <TeamFormDialog target={editing} onClose={() => setEditing(null)} />

      <Dialog open={adding} onClose={closeAdd} title="Add members" description={`Add employees to ${t.name}.`} size="md" locked={setMembers.isPending}>
        {currentIds && (
          <AddMembersForm
            existing={currentIds}
            loading={setMembers.isPending}
            error={setMembers.error != null ? parseApiError(setMembers.error).message : undefined}
            onCancel={closeAdd}
            onSubmit={async (fresh) => {
              try {
                await setMembers.mutateAsync({ id: t.id, memberIds: [...currentIds, ...fresh] })
                toast.success(fresh.length === 1 ? 'Member added.' : `${fresh.length} members added.`)
                closeAdd()
              } catch { /* shown in the dialog */ }
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        title="Remove member"
        message={removing ? <>Remove <strong className="font-semibold">{removing.personal.full_name}</strong> from {t.name}? Their attendance is not affected.</> : null}
        confirmLabel="Remove member"
        destructive
        loading={setMembers.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing || !currentIds) return
          try {
            await setMembers.mutateAsync({ id: t.id, memberIds: currentIds.filter((m) => m !== removing.id) })
            toast.success('Member removed.')
            setRemoving(null)
          } catch (e) {
            toast.error(parseApiError(e).message)
          }
        }}
      />

      <ConfirmDialog
        open={deleting}
        title="Delete team"
        message={<>Delete <strong className="font-semibold">{t.name}</strong>? Employees are not deleted; they are only removed from this team.</>}
        confirmLabel="Delete team"
        destructive
        loading={removeTeam.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await removeTeam.mutateAsync(t.id)
            toast.success('Team deleted.')
            navigate('/teams', { replace: true })
          } catch (e) {
            toast.error(parseApiError(e).message)
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}
