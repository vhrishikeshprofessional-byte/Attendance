import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { listEmployees, removeEmployee } from '@/api/employees'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { EmployeeDialog } from './EmployeeDialog'

export function EmployeesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { q }],
    queryFn: () => listEmployees({ q, page_size: 100 }),
  })

  const deleteMut = useMutation({
    mutationFn: removeEmployee,
    onSuccess: () => {
      toast.success('Employee deleted')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: () => toast.error('Failed to delete employee')
  })

  const employees = data?.items || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your company's employees and their accounts.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setIsDialogOpen(true) }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input 
              placeholder="Search employees..." 
              value={q} 
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Role / Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center">No employees found.</td></tr>
              ) : (
                employees.map((emp: any) => (
                  <tr key={emp.id || emp._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{emp.personal?.full_name}</div>
                      <div className="text-xs text-gray-500">{emp.employee_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{emp.work_email}</div>
                      <div className="text-xs">{emp.personal?.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="capitalize font-medium text-gray-900">{emp.role}</div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => { setEditingId(emp.id || emp._id); setIsDialogOpen(true) }}
                        >
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this employee?')) {
                              deleteMut.mutate(emp.id || emp._id)
                            }
                          }}
                          disabled={emp.role === 'admin' || deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isDialogOpen && (
        <EmployeeDialog 
          employeeId={editingId} 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen} 
        />
      )}
    </div>
  )
}
