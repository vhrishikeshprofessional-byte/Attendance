import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Search, Filter, RefreshCw, Plus, Trash2, FileText, Clock, AlertTriangle } from 'lucide-react'
import { listAttendance, updateAttendance, createAttendance, removeAttendance } from '@/api/attendance'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { format } from 'date-fns'

export function AttendanceManagerPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  
  // URL or State filters
  const [employeeId, setEmployeeId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filters, setFilters] = useState<{employee?: string, from_date?: string, to_date?: string}>({})
  
  // Dialogs
  const [editingSession, setEditingSession] = useState<any>(null)
  const [isAdding, setIsAdding] = useState(false)
  
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['attendance', 'manager', filters],
    queryFn: () => listAttendance({ ...filters, page_size: 200 }),
  })
  
  const sessions = data?.items || []

  // Mutations
  const addMut = useMutation({
    mutationFn: (data: any) => createAttendance(data),
    onSuccess: () => {
      toast.success('Session added')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      setIsAdding(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Failed to add session')
  })

  const updateMut = useMutation({
    mutationFn: (data: any) => updateAttendance(editingSession.id, data),
    onSuccess: () => {
      toast.success('Session updated')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      setEditingSession(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Failed to update session')
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeAttendance(id),
    onSuccess: () => {
      toast.success('Session deleted')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    }
  })

  const applyFilters = () => {
    setFilters({
      employee: employeeId.trim() || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined
    })
  }
  
  const totalMinutes = useMemo(() => {
    return sessions.reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0)
  }, [sessions])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Attendance Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Comprehensive auditing and modification of employee attendance records.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Missing Session
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Filters Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 items-end">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee Identity</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Employee ID or Email" 
                value={employeeId} 
                onChange={(e) => setEmployeeId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="pl-9 bg-white"
              />
            </div>
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Date</label>
            <Input type="date" className="bg-white" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Date</label>
            <Input type="date" className="bg-white" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button onClick={applyFilters} className="w-full sm:w-auto shadow-sm">
            <Filter className="h-4 w-4 mr-2" />
            Search Records
          </Button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-white text-xs uppercase text-gray-400 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Duration</th>
                <th className="px-6 py-4 font-semibold">Entry Time</th>
                <th className="px-6 py-4 font-semibold">Exit Time</th>
                <th className="px-6 py-4 font-semibold">Status / Source</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={7} className="p-12 text-center text-gray-400">Loading enterprise records...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-gray-400">No attendance records found. Adjust your filters.</td></tr>
              ) : (
                sessions.map((session: any) => {
                  const hrs = Math.floor((session.duration_minutes || 0) / 60)
                  const mins = (session.duration_minutes || 0) % 60
                  return (
                    <tr key={session.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{session.employee?.full_name || 'Unknown'}</div>
                        <div className="text-xs font-medium text-gray-400 mt-0.5">{session.employee?.employee_id || session.employee_id}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{format(new Date(session.date), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4">
                        {session.is_open ? (
                          <span className="text-gray-400 italic">Tracking...</span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{hrs}h {mins}m</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">{session.duration_minutes} MINS</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{new Date(session.entry_time_iso || session.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className="px-6 py-4 font-medium">
                        {session.exit_time_iso ? <span className="text-gray-900">{new Date(session.exit_time_iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span> : (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600">
                            IN PROGRESS
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                           <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            session.source === 'live' || session.source === 'check_in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                            session.source === 'manual' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-gray-100 text-gray-700'
                           }`}>
                             {session.source}
                           </span>
                           {session.note && (
                             <span className="inline-flex items-center text-[10px] text-gray-400 max-w-[120px] truncate" title={session.note}>
                               <FileText className="h-3 w-3 mr-1" />
                               {session.note}
                             </span>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="secondary" size="sm" onClick={() => setEditingSession(session)} title="Edit Record">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => {
                            if (confirm('Delete this record permanently?')) {
                              deleteMut.mutate(session.id)
                            }
                          }} title="Delete Record">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Summary */}
        <div className="bg-gray-50/50 p-4 border-t border-gray-100 flex justify-between items-center text-sm">
          <div className="text-gray-500 font-medium">Showing {sessions.length} records</div>
          <div className="flex items-center gap-6 text-gray-700 font-medium">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-indigo-500" />
              Total Logged: <span className="ml-2 font-bold text-gray-900">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSession} onClose={() => setEditingSession(null)} title="Modify Attendance Record">
        {editingSession && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            updateMut.mutate({
              entry_time: fd.get('entry_time'),
              exit_time: fd.get('exit_time') || null,
              note: fd.get('note') || null,
              version: editingSession.version
            })
          }} className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 mb-4 flex items-start">
              <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Audit Trail Warning</strong>
                Modifying this record for <strong>{editingSession.employee?.full_name || 'Employee'}</strong> will be recorded in the system audit log.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Entry Time (Local Date/Time)" htmlFor="entry_time" required>
                <Input type="datetime-local" id="entry_time" name="entry_time" defaultValue={(editingSession.entry_time_iso || editingSession.entry_time).slice(0,16)} required />
              </Field>
              <Field label="Exit Time (Local Date/Time)" htmlFor="exit_time">
                <Input type="datetime-local" id="exit_time" name="exit_time" defaultValue={editingSession.exit_time_iso ? editingSession.exit_time_iso.slice(0,16) : ''} />
              </Field>
            </div>
            <Field label="Modification Reason / Note" htmlFor="note">
              <Input id="note" name="note" placeholder="E.g. Forgot to punch out, system error..." defaultValue={editingSession.note || ''} />
            </Field>
            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={() => setEditingSession(null)}>Cancel</Button>
              <Button type="submit" loading={updateMut.isPending}>Save Changes</Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAdding} onClose={() => setIsAdding(false)} title="Add Missing Session">
        <form onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.target as HTMLFormElement);
          addMut.mutate({
            employee: fd.get('employee') as string,
            entry_time: fd.get('entry_time') as string,
            exit_time: fd.get('exit_time') || null,
            note: fd.get('note') || null,
          })
        }} className="space-y-4">
          <Field label="Employee ID" htmlFor="employee" required>
            <Input id="employee" name="employee" placeholder="E.g. EMP001" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entry Time" htmlFor="entry_time" required>
              <Input type="datetime-local" id="entry_time" name="entry_time" required />
            </Field>
            <Field label="Exit Time (Optional)" htmlFor="exit_time">
              <Input type="datetime-local" id="exit_time" name="exit_time" />
            </Field>
          </div>
          <Field label="Reason / Note" htmlFor="note" required>
            <Input id="note" name="note" placeholder="E.g. Manual entry authorized by HR" required />
          </Field>
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button type="submit" loading={addMut.isPending}>Add Session</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
