import { useEffect, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getEmployee } from '@/api/employees'
import { useEmployeeList } from '@/hooks/useEmployees'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import type { User } from '@/types/api'

interface EmployeeSelectProps {
  /** Id of the text input (match a <Field htmlFor>). */
  id: string
  /** Selected employee ids (the backend `id`, not `employee_id`). */
  value: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

const toOption = (u: User): ComboboxOption => ({
  value: u.id,
  label: u.personal.full_name,
  description: `${u.employee_id} - ${u.work_email}`,
})

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t) }, [value, ms])
  return v
}

/** Async employee search select (admin only: it calls GET /employees). Names for pre-selected ids are fetched on demand. */
export function EmployeeSelect({ id, value, onChange, multiple = false, ariaLabel, placeholder = 'Search employees', disabled, invalid, className }: EmployeeSelectProps) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const list = useEmployeeList({ q: q || undefined, page_size: 20 })
  const known = useRef(new Map<string, ComboboxOption>())

  list.data?.items.forEach((u) => known.current.set(u.id, toOption(u)))

  // Ids that arrived from the URL or a form but were not in any search result yet.
  const missing = value.filter((v) => !known.current.has(v))
  const lookups = useQueries({
    queries: missing.map((mid) => ({ queryKey: ['employee', mid], queryFn: () => getEmployee(mid), staleTime: 60_000 })),
  })
  lookups.forEach((l) => { if (l.data) known.current.set(l.data.id, toOption(l.data)) })

  const options = (list.data?.items ?? []).map(toOption)
  const selected = value.map((v) => known.current.get(v) ?? { value: v, label: 'Loading...' })

  return (
    <Combobox
      id={id}
      ariaLabel={ariaLabel}
      options={options}
      selected={selected}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      multiple={multiple}
      loading={list.isFetching}
      placeholder={placeholder}
      emptyText="No employees found"
      disabled={disabled}
      invalid={invalid}
      className={className}
    />
  )
}
