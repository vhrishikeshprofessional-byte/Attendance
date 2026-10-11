import { useState } from 'react'
import { useTeams } from '@/hooks/useTeams'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'

interface TeamSelectProps {
  /** Id of the text input (match a <Field htmlFor>). */
  id: string
  /** Selected team ids. */
  value: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/** Team select. Teams are few, so the full list is loaded once and filtered in the browser. */
export function TeamSelect({ id, value, onChange, multiple = false, ariaLabel, placeholder = 'Search teams', disabled, invalid, className }: TeamSelectProps) {
  const [query, setQuery] = useState('')
  const teams = useTeams()

  const all: ComboboxOption[] = (teams.data ?? []).map((t) => ({
    value: t.id,
    label: t.name,
    description: t.member_count != null ? `${t.member_count} member${t.member_count === 1 ? '' : 's'}` : undefined,
  }))
  const needle = query.trim().toLowerCase()
  const options = needle ? all.filter((o) => o.label.toLowerCase().includes(needle)) : all
  const selected = value.map((v) => all.find((o) => o.value === v) ?? { value: v, label: teams.isLoading ? 'Loading...' : 'Unknown team' })

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
      loading={teams.isLoading}
      placeholder={placeholder}
      emptyText="No teams found"
      disabled={disabled}
      invalid={invalid}
      className={className}
    />
  )
}
