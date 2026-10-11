import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface FilterBarProps {
  children: ReactNode
  /** Shows a "Clear filters" button when `hasActiveFilters` is true. */
  onClear?: () => void
  hasActiveFilters?: boolean
  className?: string
}

/**
 * Card that holds a page's filters. It does not own any state: pages keep filters in the URL
 * (`useSearchParams`) and pass the controls in as children.
 */
export function FilterBar({ children, onClear, hasActiveFilters = false, className }: FilterBarProps) {
  return (
    <div role="search" aria-label="Filters" className={cn('flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4', className)}>
      {children}
      {onClear && hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="self-end">
          <X className="h-4 w-4" aria-hidden /> Clear filters
        </Button>
      )}
    </div>
  )
}

/** Small label above a filter control. `htmlFor` must equal the control's id. */
export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

interface SearchInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  debounceMs?: number
  className?: string
}

/** Text search that reports its value after the user stops typing. */
export function SearchInput({ id, value, onChange, label = 'Search', placeholder = 'Search', debounceMs = 300, className }: SearchInputProps) {
  const [text, setText] = useState(value)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { setText(value) }, [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const change = (next: string) => {
    setText(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onChange(next.trim()), debounceMs)
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
      <Input
        id={id}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        value={text}
        onChange={(e) => change(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}
