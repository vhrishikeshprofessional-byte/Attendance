import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function AuditLogPage() {
  const [q, setQ] = useState('')
  
  const { data, isLoading } = useQuery({
    queryKey: ['audit_logs', { q }],
    queryFn: () => api.get('/audit-logs', { params: { q, page_size: 100 } }).then(r => r.data),
  })

  const logs = data?.items || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">System-wide audit logs.</p>
      </div>
      
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <Input placeholder="Search logs..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Actor</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center">No audit logs found.</td></tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{new Date(log.ts).toLocaleString()}</td>
                    <td className="px-6 py-4">{log.actor_name || log.actor_id}</td>
                    <td className="px-6 py-4">{log.action}</td>
                    <td className="px-6 py-4">{log.entity?.type} / {log.entity?.id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
