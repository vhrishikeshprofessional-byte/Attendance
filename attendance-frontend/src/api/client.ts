import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse } from '@/types/api'

export const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
export const REFRESH_KEY = 'attendance.refresh_token'

// Access token lives in memory only. Refresh token is in localStorage (known trade-off for a local-only app;
// move to an httpOnly cookie before any public deployment).
let accessToken: string | null = null
export const setAccessToken = (t: string | null) => { accessToken = t }
export const getAccessToken = () => accessToken
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY)
export const setRefreshToken = (t: string | null) => (t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY))

const serializer = { indexes: null as null } // repeatable params: employee_id=a&employee_id=b

export const api = axios.create({ baseURL: BASE_URL, paramsSerializer: serializer, timeout: 20_000 })
const bare = axios.create({ baseURL: BASE_URL, paramsSerializer: serializer, timeout: 20_000 }) // no interceptors

/** Swap the transport (used by the in-memory mock API). */
export function installAdapter(adapter: AxiosAdapter) {
  api.defaults.adapter = adapter
  bare.defaults.adapter = adapter
}

let onSessionLost: (() => void) | null = null
export const setSessionLostHandler = (fn: (() => void) | null) => { onSessionLost = fn }

let refreshing: Promise<AuthResponse> | null = null
/** Single-flight refresh: concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse> {
  if (!refreshing) {
    const rt = getRefreshToken()
    if (!rt) return Promise.reject(new Error('no refresh token'))
    refreshing = bare
      .post<AuthResponse>('/auth/refresh', { refresh_token: rt })
      .then((r) => { setAccessToken(r.data.access_token); setRefreshToken(r.data.refresh_token); return r.data })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean }
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const cfg = error.config as Retriable | undefined
    const url = cfg?.url ?? ''
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/refresh') || url.startsWith('/auth/signup')
    if (error.response?.status === 401 && cfg && !cfg._retried && !isAuthCall && getRefreshToken()) {
      cfg._retried = true
      try {
        await refreshSession() // other failed requests wait on the same shared refresh promise
        return api(cfg)
      } catch {
        setAccessToken(null); setRefreshToken(null)
        onSessionLost?.()
      }
    }
    return Promise.reject(error)
  },
)
