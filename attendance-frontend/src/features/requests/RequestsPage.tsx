import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRequests, listMyRequests, approveRequest, rejectRequest, withdrawRequest } from '@/api/changeRequests'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { displayDate } from '@/lib/time'
import { parseApiError } from '@/lib/errors'
import type { ChangeRequest, CRStatus } from '@/types/api'

function CRActionLabel({ action }: { action: string }) {
  if (action === 'edit') return <span>Update Attendance</span>
  if (action === 'delete') return <span>Delete Attendance</span>
  if (action === 'add') return <span>Add Attendance</span>
  return <span className="capitalize">{action.replace('_', ' ')}</span>
}

export function RequestsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const toast = useToast()
  const queryClient = useQueryClient()
  
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [status, setStatus] = useState<CRStatus | ''>('pending')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['requests', { status, page, page_size: pageSize }],
    queryFn: () => isAdmin 
      ? listRequests({ status: status || undefined, page, page_size: pageSize })
      : listMyRequests({ status: status || undefined, page, page_size: pageSize }),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => approveRequest(id),
    onSuccess: () => { toast.success('Request approved'); queryClient.invalidateQueries({ queryKey: ['requests'] }) },
    onError: (err) => toast.error(parseApiError(err).message)
  })

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectRequest(id, 'Rejected by admin'),
    onSuccess: () => { toast.success('Request rejected'); queryClient.invalidateQueries({ queryKey: ['requests'] }) },
    onError: (err) => toast.error(parseApiError(err).message)
  })
  
  const withdrawMut = useMutation({
    mutationFn: (id: string) => withdrawRequest(id),
    onSuccess: () => { toast.success('Request withdrawn'); queryClient.invalidateQueries({ queryKey: ['requests'] }) },
    onError: (err) => toast.error(parseApiError(err).message)
  })

  const columns: Column<ChangeRequest>[] = [
    {
      key: 'created_at',
      header: 'Date',
      cell: (r) => <span className="whitespace-nowrap">{displayDate(r.created_at, 'numeric')}</span>,
    },
    {
      key: 'requester',
      header: isAdmin ? 'Requester' : 'Target',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.requester?.full_name || 'Me'}</div>
          {isAdmin && <div className="text-xs text-gray-500">{r.requester?.employee_id}</div>}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (r) => <CRActionLabel action={r.action} />,
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (r) => <div className="max-w-xs truncate" title={r.reason}>{r.reason || '-'}</div>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusChip status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (r) => {
        if (r.status !== 'pending') return <span className="text-gray-400 text-xs">No actions</span>
        
        return (
          <div className="flex gap-2 justify-end">
            {isAdmin ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => rejectMut.mutate(r.id)} loading={rejectMut.isPending} disabled={approveMut.isPending}><X className="h-4 w-4 mr-1"/> Reject</Button>
                <Button size="sm" onClick={() => approveMut.mutate(r.id)} loading={approveMut.isPending} disabled={rejectMut.isPending}><Check className="h-4 w-4 mr-1"/> Approve</Button>
              </>
            ) : (
              <Button size="sm" variant="danger" onClick={() => { if(window.confirm('Withdraw request?')) withdrawMut.mutate(r.id) }} loading={withdrawMut.isPending}>Withdraw</Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{isAdmin ? 'Review requests' : 'My requests'}</h1>
        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value as CRStatus | ''); setPage(1) }}
          className="rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      <DataTable
        caption="Change requests"
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        emptyTitle="No requests found"
        emptyDescription="You're all caught up."
        pagination={data?.meta}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />
    </div>
  )
}
