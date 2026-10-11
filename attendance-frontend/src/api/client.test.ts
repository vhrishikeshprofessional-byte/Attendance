import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REFRESH_KEY, api, getAccessToken, getRefreshToken, installAdapter, setAccessToken, setRefreshToken, setSessionLostHandler } from './client'

type Reply = { status: number; data?: unknown }
function use(handler: (cfg: InternalAxiosRequestConfig) => Reply) {
  const calls: InternalAxiosRequestConfig[] = []
  installAdapter(async (cfg) => {
    calls.push(cfg)
    const { status, data } = handler(cfg)
    const res = { status, data, statusText: '', headers: {}, config: cfg } as AxiosResponse
    if (status >= 400) throw new AxiosError('err', String(status), cfg, null, res)
    return res
  })
  return calls
}
const refreshCalls = (calls: InternalAxiosRequestConfig[]) => calls.filter((c) => c.url === '/auth/refresh')

beforeEach(() => { localStorage.clear(); setAccessToken(null); setSessionLostHandler(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('api client', () => {
  it('sends the in-memory access token as a bearer header', async () => {
    const calls = use(() => ({ status: 200, data: {} }))
    setAccessToken('abc')
    await api.get('/x')
    expect(String(calls[0].headers.Authorization)).toBe('Bearer abc')
  })

  it('stores the refresh token in localStorage and clears it with null', () => {
    setRefreshToken('r1')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('r1')
    expect(getRefreshToken()).toBe('r1')
    setRefreshToken(null)
    expect(getRefreshToken()).toBeNull()
  })

  it('on 401 refreshes once and retries with the new token', async () => {
    setAccessToken('old'); setRefreshToken('r1')
    const calls = use((cfg) => {
      if (cfg.url === '/auth/refresh') return { status: 200, data: { access_token: 'new', refresh_token: 'r2' } }
      return String(cfg.headers.Authorization) === 'Bearer old' ? { status: 401 } : { status: 200, data: { ok: true } }
    })
    const res = await api.get('/x')
    expect(res.data).toEqual({ ok: true })
    expect(refreshCalls(calls)).toHaveLength(1)
    expect(String(calls[calls.length - 1].headers.Authorization)).toBe('Bearer new')
    expect(getAccessToken()).toBe('new')
    expect(getRefreshToken()).toBe('r2')
  })

  it('concurrent 401s share a single refresh request', async () => {
    setAccessToken('old'); setRefreshToken('r1')
    const calls = use((cfg) => {
      if (cfg.url === '/auth/refresh') return { status: 200, data: { access_token: 'new', refresh_token: 'r2' } }
      return String(cfg.headers.Authorization) === 'Bearer old' ? { status: 401 } : { status: 200, data: {} }
    })
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])
    expect(refreshCalls(calls)).toHaveLength(1)
  })

  it('when refresh fails it clears tokens, notifies, and rejects', async () => {
    setAccessToken('old'); setRefreshToken('r1')
    const lost = vi.fn()
    setSessionLostHandler(lost)
    use((cfg) => (cfg.url === '/auth/refresh' ? { status: 401 } : { status: 401 }))
    await expect(api.get('/x')).rejects.toMatchObject({ response: { status: 401 } })
    expect(lost).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('does not try to refresh on auth endpoints', async () => {
    setRefreshToken('r1')
    const calls = use(() => ({ status: 401 }))
    await expect(api.post('/auth/login', {})).rejects.toBeTruthy()
    expect(calls).toHaveLength(1)
  })

  it('does not retry when there is no refresh token', async () => {
    const calls = use(() => ({ status: 401 }))
    await expect(api.get('/x')).rejects.toBeTruthy()
    expect(calls).toHaveLength(1)
  })

  it('does not retry the same request twice', async () => {
    setAccessToken('old'); setRefreshToken('r1')
    const calls = use((cfg) => (cfg.url === '/auth/refresh' ? { status: 200, data: { access_token: 'new', refresh_token: 'r2' } } : { status: 401 }))
    await expect(api.get('/x')).rejects.toBeTruthy()
    expect(calls.filter((c) => c.url === '/x')).toHaveLength(2)
  })
})
