import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { applyFieldErrors, parseApiError } from './errors'

function mk(status: number | null, data?: unknown, headers: Record<string, string> = {}) {
  const config = { headers: {} } as InternalAxiosRequestConfig
  const response = status === null ? undefined : ({ status, data, headers, statusText: '', config } as AxiosResponse)
  return new AxiosError('fail', 'ERR', config, null, response)
}
const body = (code: string, message: string, details?: unknown) => ({ error: { code, message, details } })

describe('parseApiError', () => {
  it('non-axios errors become a generic server error', () => {
    expect(parseApiError(new Error('x'))).toMatchObject({ status: null, code: 'UNKNOWN', kind: 'server' })
  })
  it('no response -> network', () => {
    expect(parseApiError(mk(null))).toMatchObject({ kind: 'network', code: 'NETWORK' })
  })
  it('422 maps backend details to field errors and drops "body" from loc', () => {
    const p = parseApiError(mk(422, body('VALIDATION_ERROR', 'Request validation failed', [
      { loc: ['body', 'password'], message: 'too short', type: 'x' },
      { loc: ['body', 'address', 'city'], message: 'required', type: 'x' },
    ])))
    expect(p.kind).toBe('validation')
    expect(p.message).toBe('Request validation failed')
    expect(p.fieldErrors).toEqual({ password: 'too short', 'address.city': 'required' })
  })
  it('keeps only string values from object details', () => {
    expect(parseApiError(mk(409, body('DUPLICATE', 'dup', { fields: ['work_email'], note: 'x' }))).fieldErrors).toEqual({ note: 'x' })
  })
  it.each([
    [400, 'validation'], [401, 'auth'], [403, 'forbidden'], [404, 'notfound'], [409, 'conflict'], [429, 'ratelimit'], [423, 'locked'], [500, 'server'], [503, 'server'],
  ])('status %i -> %s', (status, kind) => {
    expect(parseApiError(mk(status as number, body('X', 'msg'))).kind).toBe(kind)
  })
  it('uses the server message for 4xx and hides it for 5xx', () => {
    expect(parseApiError(mk(403, body('FORBIDDEN', 'Nope'))).message).toBe('Nope')
    expect(parseApiError(mk(500, body('INTERNAL', 'stack trace'))).message).toBe('Something went wrong on our side. Try again.')
  })
  it('falls back to default messages when the body is missing', () => {
    expect(parseApiError(mk(404)).message).toBe('Not found.')
    expect(parseApiError(mk(401)).message).toMatch(/session has expired/i)
  })
  it('reads Retry-After for rate limits', () => {
    const p = parseApiError(mk(429, body('RATE_LIMITED', 'x'), { 'retry-after': '120' }))
    expect(p.retryAfterSeconds).toBe(120)
    expect(p.message).toContain('2 min')
  })
  it('rate limit without header says try later', () => {
    expect(parseApiError(mk(429)).message).toBe('Too many requests. Try again later.')
  })
})

describe('applyFieldErrors', () => {
  it('pushes every field error and reports whether any matched', () => {
    const setError = vi.fn()
    const parsed = parseApiError(mk(422, body('V', 'm', [{ loc: ['body', 'email'], message: 'bad' }])))
    expect(applyFieldErrors(parsed, setError)).toBe(true)
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'bad' })
    expect(applyFieldErrors(parseApiError(mk(500)), setError)).toBe(false)
  })
})
