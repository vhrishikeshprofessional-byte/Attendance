import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ComboboxOption { value: string; label: string; description?: string }

interface ComboboxProps {
  /** Id of the text input, so a <Field htmlFor={id}> label points at it. */
  id: string
  /** Accessible name when no visible label points at `id`. */
  ariaLabel?: string
  /** Options currently offered (already filtered by the parent). */
  options: ComboboxOption[]
  /** Selected options with their labels (the parent resolves ids to labels). */
  selected: ComboboxOption[]
  onChange: (values: string[]) => void
  query: string
  onQueryChange: (query: string) => void
  multiple?: boolean
  loading?: boolean
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/**
 * Accessible search select (ARIA combobox with a listbox). Single or multiple.
 * Selected items show as removable chips; the parent owns the search text and the option list,
 * so it works for both server-side search and local filtering.
 */
export function Combobox({
  id, ariaLabel, options, selected, onChange, query, onQueryChange, multiple = false, loading = false,
  placeholder = 'Search', emptyText = 'No matches', disabled = false, invalid = false, className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const refocus = useRef(false)
  const listId = useId()

  const selectedValues = new Set(selected.map((s) => s.value))
  const showInput = multiple || selected.length === 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => { setActive(0) }, [query, options.length])

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, listId])

  // After clearing a single selection the input mounts again; give it focus.
  useEffect(() => {
    if (refocus.current && showInput) { inputRef.current?.focus(); refocus.current = false }
  }, [showInput])

  const toggle = (opt: ComboboxOption) => {
    if (multiple) {
      onChange(selectedValues.has(opt.value) ? selected.filter((s) => s.value !== opt.value).map((s) => s.value) : [...selected.map((s) => s.value), opt.value])
      onQueryChange('')
    } else {
      onChange([opt.value])
      onQueryChange('')
      setOpen(false)
    }
  }

  const remove = (value: string) => {
    if (!multiple) refocus.current = true
    onChange(selected.filter((s) => s.value !== value).map((s) => s.value))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && options[active]) { e.preventDefault(); toggle(options[active]) }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    } else if (e.key === 'Backspace' && !query && multiple && selected.length) {
      remove(selected[selected.length - 1].value)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-1 text-sm focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2',
          invalid ? 'border-red-500' : 'border-gray-300',
          disabled && 'cursor-not-allowed bg-gray-50',
        )}
      >
        {selected.map((s) => (
          <span key={s.value} className="inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 py-0.5 pl-2 pr-1 text-xs font-medium text-gray-800">
            <span className="max-w-[14rem] truncate">{s.label}</span>
            <button type="button" disabled={disabled} onClick={() => remove(s.value)} aria-label={`Remove ${s.label}`} className="rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-40">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        {showInput && (
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            disabled={disabled}
            value={query}
            placeholder={selected.length ? '' : placeholder}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => { onQueryChange(e.target.value); setOpen(true) }}
            onKeyDown={onKeyDown}
            className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 py-0.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
          />
        )}
      </div>
      {open && showInput && (
        <ul id={listId} role="listbox" aria-multiselectable={multiple || undefined} className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.length === 0 ? (
            <li role="presentation" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
              {loading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching</>) : emptyText}
            </li>
          ) : (
            options.map((o, i) => {
              const isSelected = selectedValues.has(o.value)
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex cursor-pointer items-center gap-2 px-3 py-2 text-sm', i === active ? 'bg-indigo-50' : 'bg-white')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-900">{o.label}</span>
                    {o.description && <span className="block truncate text-xs text-gray-600">{o.description}</span>}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
