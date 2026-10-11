import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, Settings, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ui/Toast'

const MENU_ITEM = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'

export function Topbar({ onMenuClick, navOpen }: { onMenuClick: () => void; navOpen: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const signOut = async () => {
    setBusy(true)
    await logout()
    toast.success('Signed out.')
    navigate('/login', { replace: true })
  }

  const name = user?.personal.full_name ?? 'Account'

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="app-sidebar"
        aria-expanded={navOpen}
        className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex-1" />
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700" aria-hidden>
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
          <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-gray-900">{name}</p>
              <p className="truncate text-xs text-gray-600">{user?.work_email}</p>
            </div>
            <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className={MENU_ITEM}>
              <UserIcon className="h-4 w-4" aria-hidden /> Profile
            </Link>
            <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className={MENU_ITEM}>
              <Settings className="h-4 w-4" aria-hidden /> Settings
            </Link>
            <button role="menuitem" type="button" onClick={signOut} disabled={busy} className={`${MENU_ITEM} disabled:opacity-50`}>
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
