import { createContext, useContext, useState, type ReactNode } from 'react'
import type { DateFormat } from '@/types/api'

const KEY = 'attendance.date_format'
const Ctx = createContext<{ dateFormat: DateFormat; setDateFormat: (f: DateFormat) => void }>({ dateFormat: 'long', setDateFormat: () => {} })

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [dateFormat, set] = useState<DateFormat>(() => (localStorage.getItem(KEY) === 'numeric' ? 'numeric' : 'long'))
  const setDateFormat = (f: DateFormat) => { localStorage.setItem(KEY, f); set(f) }
  return <Ctx.Provider value={{ dateFormat, setDateFormat }}>{children}</Ctx.Provider>
}
export const usePrefs = () => useContext(Ctx)
