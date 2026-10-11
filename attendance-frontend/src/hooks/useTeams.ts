import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/teams'
import { invalidate } from '@/lib/queryClient'

export function useTeams(enabled = true) {
  return useQuery({ queryKey: ['teams'], queryFn: api.listTeams, enabled })
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ['teams', 'detail', id],
    queryFn: () => api.getTeam(id as string),
    enabled: !!id,
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof api.createTeam>[0]) => api.createTeam(body),
    onSuccess: () => invalidate(qc, 'teams'),
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateTeam>[1] }) => api.updateTeam(id, body),
    onSuccess: () => invalidate(qc, 'teams', 'employees', 'report'),
  })
}

export function useRemoveTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.removeTeam(id),
    onSuccess: () => invalidate(qc, 'teams', 'employees', 'employee', 'report'),
  })
}

/** Replaces the full member list of a team. */
export function useSetTeamMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, memberIds }: { id: string; memberIds: string[] }) => api.setTeamMembers(id, memberIds),
    onSuccess: () => invalidate(qc, 'teams', 'employees', 'employee', 'report'),
  })
}
