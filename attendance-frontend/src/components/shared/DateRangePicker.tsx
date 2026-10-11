import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { istToday, periodRange } from '@/lib/time'

type PresetKey = 'today' | 'week' | 'month'

interface DateRangePickerProps {
  /** ISO dates (yyyy-MM-dd) in IST. */
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  /** Prefix for the input ids. Default "range". */
  idPrefix?: string
  className?: string
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
]

function rangeFor(key: PresetKey): { from: string; to: string } {
  const today = istToday()
  if (key === 'today') return { from: today, to: today }
  return periodRange(key === 'week' ? 'weekly' : 'monthly', today)
}

const BTN = 'rounded-md px-3 py-1.5 text-xs font-medium'

/** Presets (Today, This week, This month, Custom) plus two date inputs. Keeps `from` on or before `to`. */
export function DateRangePicker({ from, to, onChange, idPrefix = 'range', className }: DateRangePickerProps) {
  const fromRef = useRef<HTMLInputElement>(null)
  const activePreset = PRESETS.find((p) => { const r = rangeFor(p.key); return r.from === from && r.to === to })?.key
  const isCustom = !activePreset

  const changeFrom = (v: string) => {
    if (!v) return
    onChange({ from: v, to: to && v > to ? v : to })
  }
  const changeTo = (v: string) => {
    if (!v) return
    onChange({ from: from && v < from ? v : from, to: v })
  }

  const inputCls = 'h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900'

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div role="group" aria-label="Date range presets" className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={activePreset === p.key}
            onClick={() => onChange(rangeFor(p.key))}
            className={cn(BTN, activePreset === p.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-700 hover:bg-gray-200')}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => fromRef.current?.focus()}
          className={cn(BTN, isCustom ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-700 hover:bg-gray-200')}
        >
          Custom
        </button>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-from`} className="block text-xs font-medium text-gray-700">From</label>
        <input ref={fromRef} id={`${idPrefix}-from`} type="date" value={from} max={to || undefined} onChange={(e) => changeFrom(e.target.value)} className={inputCls} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-to`} className="block text-xs font-medium text-gray-700">To</label>
        <input id={`${idPrefix}-to`} type="date" value={to} min={from || undefined} onChange={(e) => changeTo(e.target.value)} className={inputCls} />
      </div>
    </div>
  )
}
