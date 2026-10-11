import { useEffect, useRef, useState } from 'react'
import { Field, Input } from '@/components/ui/Input'
import { istDateOf, istTimeOf, istToday, parseTimeInput, to12h, toIstIso } from '@/lib/time'

interface DateTimeInputProps {
  label: string
  /** Base id. The date input uses `${id}-date` and the time input `${id}-time`. */
  id: string
  /** ISO 8601 instant (any offset), or '' when empty or incomplete. Displayed in IST. */
  value: string
  /** Called with ISO 8601 using the IST offset (+05:30), or '' while the date or time is empty or invalid. */
  onChange: (iso: string) => void
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  /** Block future dates in the date picker. Default true (the backend rejects future times). */
  noFuture?: boolean
  className?: string
}

const split = (iso: string) => (iso ? { date: istDateOf(iso), time: to12h(istTimeOf(iso)) } : { date: '', time: '' })

/** IST date + time entry. The time accepts "6:26 PM", "6:26:56 pm", "18:26" or "18:26:56". */
export function DateTimeInput({ label, id, value, onChange, error, hint, required, disabled, noFuture = true, className }: DateTimeInputProps) {
  const [date, setDate] = useState(() => split(value).date)
  const [time, setTime] = useState(() => split(value).time)
  const [timeTouched, setTimeTouched] = useState(false)
  const lastEmitted = useRef(value)

  // Reset when the parent changes the value from outside (for example a form reset).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const s = split(value)
      setDate(s.date)
      setTime(s.time)
      lastEmitted.current = value
    }
  }, [value])

  const emit = (d: string, t: string) => {
    const parsed = parseTimeInput(t)
    const iso = d && parsed ? toIstIso(d, parsed) : ''
    lastEmitted.current = iso
    onChange(iso)
  }

  const timeInvalid = time.trim() !== '' && parseTimeInput(time) === null
  const timeError = timeInvalid && timeTouched ? 'Enter a time like 6:26 PM or 18:26.' : undefined
  const shownError = error ?? timeError

  return (
    <Field label={label} htmlFor={`${id}-date`} error={shownError} hint={hint} required={required} className={className}>
      <div className="flex gap-2">
        <Input
          id={`${id}-date`}
          type="date"
          value={date}
          max={noFuture ? istToday() : undefined}
          disabled={disabled}
          invalid={!!shownError}
          onChange={(e) => { setDate(e.target.value); emit(e.target.value, time) }}
          className="min-w-0 flex-1"
        />
        <Input
          id={`${id}-time`}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="6:26 PM"
          aria-label={`${label} time`}
          value={time}
          disabled={disabled}
          invalid={!!shownError}
          onChange={(e) => { setTime(e.target.value); emit(date, e.target.value) }}
          onBlur={() => {
            setTimeTouched(true)
            const parsed = parseTimeInput(time)
            if (parsed) setTime(to12h(parsed))
          }}
          className="w-32 shrink-0"
        />
      </div>
    </Field>
  )
}
