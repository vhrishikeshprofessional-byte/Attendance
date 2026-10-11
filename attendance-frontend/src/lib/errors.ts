import axios from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiErrorBody } from '@/types/api'

export interface ParsedError {
  status: number | null
  code: string
  message: string
  fieldErrors: Record<string, string>
  kind: 'validation' | 'auth' | 'forbidden' | 'notfound' | 'conflict' | 'ratelimit' | 'locked' | 'server' | 'network'
  retryAfterSeconds?: number
}

export function parseApiError(err: unknown): ParsedError {
  if (!axios.isAxiosError(err)) return { status: null, code: 'UNKNOWN', message: 'Something went wrong.', fieldErrors: {}, kind: 'server' }
  const status = err.response?.status ?? null
  const body = err.response?.data as Partial<ApiErrorBody> | undefined
  const code = body?.error?.code ?? 'ERROR'
  const serverMsg = body?.error?.message
  const fieldErrors: Record<string, string> = {}
  const details = body?.error?.details
  if (Array.isArray(details)) {
    for (const d of details as { loc?: (string | number)[]; field?: string; msg?: string; message?: string }[]) {
      const key = d.field ?? (d.loc ? d.loc.filter((p) => p !== 'body').join('.') : '')
      if (key) fieldErrors[key] = d.msg ?? d.message ?? 'Invalid value'
    }
  } else if (details && typeof details === 'object') {
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) if (typeof v === 'string') fieldErrors[k] = v
  }
  const retry = Number(err.response?.headers?.['retry-after'])
  const retryAfterSeconds = Number.isFinite(retry) && retry > 0 ? retry : undefined
  if (status === null) return { status, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.', fieldErrors, kind: 'network' }
  if (status === 400 || status === 422) return { status, code, message: serverMsg ?? 'Some fields are invalid.', fieldErrors, kind: 'validation' }
  if (status === 401) return { status, code, message: serverMsg ?? 'Your session has expired. Sign in again.', fieldErrors, kind: 'auth' }
  if (status === 403) return { status, code, message: serverMsg ?? 'You do not have access to this.', fieldErrors, kind: 'forbidden' }
  if (status === 404) return { status, code, message: serverMsg ?? 'Not found.', fieldErrors, kind: 'notfound' }
  if (status === 409) return { status, code, message: serverMsg ?? 'This record changed or conflicts with another. Reload and try again.', fieldErrors, kind: 'conflict' }
  if (status === 423 || status === 429) {
    const wait = retryAfterSeconds ? ` Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` : ' Try again later.'
    return { status, code, message: status === 423 ? `Too many attempts.${wait}` : `Too many requests.${wait}`, fieldErrors, kind: status === 423 ? 'locked' : 'ratelimit', retryAfterSeconds }
  }
  return { status, code, message: 'Something went wrong on our side. Try again.', fieldErrors, kind: 'server' }
}

/** Push backend field errors into React Hook Form. Returns true if any field matched. */
export function applyFieldErrors<T extends FieldValues>(parsed: ParsedError, setError: UseFormSetError<T>): boolean {
  let any = false
  for (const [k, msg] of Object.entries(parsed.fieldErrors)) { setError(k as Path<T>, { type: 'server', message: msg }); any = true }
  return any
}
