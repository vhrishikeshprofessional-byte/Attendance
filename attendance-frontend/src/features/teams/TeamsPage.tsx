import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterField, SearchInput } from '@/components/shared/FilterBar'
import { useRemoveTeam, useTeams } from '@/hooks/useTeams'
import { parseApiError } from '@/lib/errors'
import type { Team } from '@/types/api'
import { TeamFormDialog } from './TeamFormDialog'

/** Admin: list of teams with create, edit and delete. The full list is loaded once and searched in the browser. */
export function TeamsPage() {
  const toast = useToast()
  const teams = useTeams()
  const remove = useRemoveTeam()
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<Team | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Team | null>(null)

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const all = [...(teams.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    return needle ? all.filter((t) => t.name.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle)) : all
  }, [teams.data, search])

  const columns: Column<Team>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (t) => <Link to={`/teams/${t.id}`} className="font-medium text-indigo-600 hover:underline">{t.name}</Link>,
    },
    { key: 'description', header: 'Description', cell: (t) => t.description || <span className="text-gray-500">-</span>, className: 'max-w-md whitespace-normal' },
    { key: 'members', header: 'Members', align: 'right', cell: (t) => <span className="tabular-nums">{t.member_count ?? t.member_ids?.length ?? 0}</span> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (t) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setTarget(t)} aria-label={`Edit ${t.name}`}><Pencil className="h-4 w-4" aria-hidden /> Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}><Trash2 className="h-4 w-4" aria-hidden /> Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Teams</h1>
        <Button onClick={() => setTarget('new')}><Plus className="h-4 w-4" aria-hidden /> Create team</Button>
      </div>

      <FilterBar hasActiveFilters={search !== ''} onClear={() => setSearch('')}>
        <FilterField label="Search" htmlFor="teams-search" className="w-full sm:w-72">
          <SearchInput id="teams-search" value={search} onChange={setSearch} placeholder="Search teams" />
        </FilterField>
      </FilterBar>

      <DataTable
        caption="Teams"
        columns={columns}
        rows={teams.data ? rows : undefined}
        rowKey={(t) => t.id}
        loading={teams.isLoading}
        error={teams.error}
        onRetry={() => teams.refetch()}
        emptyTitle={search ? 'No teams match your search' : 'No teams yet'}
        emptyDescription={search ? 'Try a different search.' : 'Create a team to group employees for reports.'}
      />

      <TeamFormDialog target={target} onClose={() => setTarget(null)} />

      <ConfirmDialog
        open={!!deleting}
        title="Delete team"
        message={deleting ? <>Delete <strong className="font-semibold">{deleting.name}</strong>? Employees are not deleted; they are only removed from this team.</> : null}
        confirmLabel="Delete team"
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success('Team deleted.')
            setDeleting(null)
          } catch (e) {
            toast.error(parseApiError(e).message)
          }
        }}
      />
    </div>
  )
}
