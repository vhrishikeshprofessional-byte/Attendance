import { cn } from '@/lib/cn'

interface ProgressBarProps {
  /** Short name shown above the bar, e.g. "Days" or "Hours". */
  label: string
  value: number
  /** The requirement. 0 means "nothing required" and the bar shows N/A. */
  max: number
  /** Appended to the numbers, e.g. "h" gives "12.5 of 15 h". */
  unit?: string
  className?: string
}

const round = (n: number) => Math.round(n * 100) / 100

/** Progress toward a requirement (days or hours). Always shows the numbers, so it never relies on color alone. */
export function ProgressBar({ label, value, max, unit = '', className }: ProgressBarProps) {
  const applicable = max > 0
  const met = applicable && value >= max
  const pct = applicable ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const suffix = unit ? ` ${unit}` : ''
  const text = applicable ? `${round(value)} of ${round(max)}${suffix}${met ? ' (met)' : ''}` : 'Not required'

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        <span className={cn('tabular-nums', met ? 'font-medium text-green-700' : 'text-gray-600')}>{text}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={applicable ? max : 0}
        aria-valuenow={applicable ? Math.min(value, max) : 0}
        aria-valuetext={text}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div className={cn('h-full rounded-full transition-[width]', met ? 'bg-green-600' : 'bg-indigo-600')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
