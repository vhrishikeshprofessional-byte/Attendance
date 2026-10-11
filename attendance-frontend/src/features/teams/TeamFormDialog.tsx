import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useNavigate } from 'react-router-dom'
import { useCreateTeam, useUpdateTeam } from '@/hooks/useTeams'
import { parseApiError } from '@/lib/errors'
import type { Team } from '@/types/api'

const NAME_MAX = 100
const DESC_MAX = 500

function teamError(e: unknown): string {
  const p = parseApiError(e)
  return p.kind === 'conflict' ? 'A team with this name already exists.' : p.message
}

interface TeamFormProps {
  team: Team | null
  loading: boolean
  error?: string
  onSubmit: (v: { name: string; description: string }) => void
  onCancel: () => void
}

function TeamForm({ team, loading, error, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(team?.name ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [submitted, setSubmitted] = useState(false)

  const trimmed = name.trim()
  const nameError = !trimmed ? 'Enter a team name.' : trimmed.length > NAME_MAX ? `Use at most ${NAME_MAX} characters.` : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (nameError) return
    onSubmit({ name: trimmed, description: description.trim() })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name" htmlFor="team-name" required error={submitted ? nameError : undefined}>
        <Input id="team-name" value={name} maxLength={NAME_MAX} autoFocus invalid={submitted && !!nameError} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="team-desc" hint={`${description.length}/${DESC_MAX}`}>
        <Textarea id="team-desc" value={description} maxLength={DESC_MAX} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{team ? 'Save changes' : 'Create team'}</Button>
      </div>
    </form>
  )
}

interface TeamFormDialogProps {
  /** A team to edit, 'new' to create one, or null to keep the dialog closed. */
  target: Team | 'new' | null
  onClose: () => void
}

/** Create or edit a team (name and description). */
export function TeamFormDialog({ target, onClose }: TeamFormDialogProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const create = useCreateTeam()
  const update = useUpdateTeam()
  const team = target && target !== 'new' ? target : null
  const pending = create.isPending || update.isPending
  const error = create.error ?? update.error

  const close = () => { create.reset(); update.reset(); onClose() }

  return (
    <Dialog open={target !== null} onClose={close} title={team ? 'Edit team' : 'Create team'} description={!team ? 'You can add members to the team after it is created.' : undefined} size="sm" locked={pending}>
      {target !== null && (
        <TeamForm
          team={team}
          loading={pending}
          error={error != null ? teamError(error) : undefined}
          onCancel={close}
          onSubmit={async (v) => {
            try {
              if (team) {
                const body: { name?: string; description?: string } = {}
                if (v.name !== team.name) body.name = v.name
                if (v.description !== (team.description ?? '')) body.description = v.description
                if (!Object.keys(body).length) { close(); return }
                await update.mutateAsync({ id: team.id, body })
                toast.success('Team updated.')
              } else {
                const newTeam = await create.mutateAsync({ name: v.name, ...(v.description ? { description: v.description } : {}) })
                toast.success('Team created.')
                close()
                navigate(`/teams/${newTeam.id}`)
                return
              }
              close()
            } catch { /* shown in the dialog */ }
          }}
        />
      )}
    </Dialog>
  )
}
