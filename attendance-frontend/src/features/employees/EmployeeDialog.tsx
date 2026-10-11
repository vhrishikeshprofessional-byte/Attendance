import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getEmployee, createEmployee, updateEmployee } from '@/api/employees'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

export function EmployeeDialog({ employeeId, open, onOpenChange }: { employeeId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const isEditing = !!employeeId

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employees', employeeId],
    queryFn: () => getEmployee(employeeId!),
    enabled: isEditing,
  })

  const [formData, setFormData] = useState({
    full_name: '',
    work_email: '',
    password: '',
    phone: '',
    status: 'active'
  })

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.personal?.full_name || '',
        work_email: employee.work_email || '',
        password: '',
        phone: employee.personal?.phone || '',
        status: employee.status || 'active'
      })
    } else {
      setFormData({ full_name: '', work_email: '', password: '', phone: '', status: 'active' })
    }
  }, [employee])

  const saveMut = useMutation({
    mutationFn: (data: any) => {
      if (isEditing) {
        return updateEmployee(employeeId!, {
          full_name: data.full_name,
          phone: data.phone,
          status: data.status,
          version: employee?.version || 1
        })
      }
      return createEmployee(data)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Employee updated' : 'Employee created')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to save employee')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMut.mutate(formData)
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title={isEditing ? 'Edit Employee' : 'Add Employee'}>
      {isLoading && isEditing ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full Name" htmlFor="full_name" required>
            <Input
              id="full_name"
              required
              value={formData.full_name}
              onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))}
            />
          </Field>
          {!isEditing && (
            <>
              <Field label="Work Email" htmlFor="work_email" required>
                <Input
                  id="work_email"
                  type="email"
                  required
                  value={formData.work_email}
                  onChange={(e) => setFormData(p => ({ ...p, work_email: e.target.value }))}
                />
              </Field>
              <Field label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                />
              </Field>
            </>
          )}
          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
            />
          </Field>
          {isEditing && employee?.role !== 'admin' && (
            <Field label="Status" htmlFor="status">
              <select 
                id="status"
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                value={formData.status}
                onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          )}
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={saveMut.isPending}>Save</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
