import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/auth'
import { getRefreshToken, refreshSession, setAccessToken, setRefreshToken, setSessionLostHandler } from '@/api/client'
import type { User } from '@/types/api'

interface AuthState {
  user: User | null
  loading: boolean
  signup: (b: Parameters<typeof authApi.signup>[0]) => Promise<User>
  login: (identifier: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User) => void
}
const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !!getRefreshToken())

  const clear = useCallback(() => { setAccessToken(null); setRefreshToken(null); setUser(null); qc.clear() }, [qc])

  // Restore the session on page load.
  useEffect(() => {
    if (!getRefreshToken()) return
    refreshSession()
      .then(async (r) => setUser(r.user ?? (await authApi.me())))
      .catch(() => clear())
      .finally(() => setLoading(false))
  }, [clear])

  useEffect(() => { setSessionLostHandler(() => { setUser(null); qc.clear() }); return () => setSessionLostHandler(null) }, [qc])

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await authApi.login(identifier, password)
    setAccessToken(r.access_token); setRefreshToken(r.refresh_token)
    const u = r.user ?? (await authApi.me())
    setUser(u)
    return u
  }, [])

  const signup = useCallback(async (b: Parameters<typeof authApi.signup>[0]) => {
    const r = await authApi.signup(b)
    setAccessToken(r.access_token); setRefreshToken(r.refresh_token)
    const u = r.user ?? (await authApi.me())
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout(getRefreshToken()) } catch { /* best effort */ }
    clear()
  }, [clear])

  const value = useMemo(() => ({ user, loading, signup, login, logout, setUser }), [user, loading, signup, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
export const useIsAdmin = () => useAuth().user?.role === 'admin'
