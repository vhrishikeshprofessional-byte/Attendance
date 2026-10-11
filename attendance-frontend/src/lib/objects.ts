// Helpers for "send only changed fields" and for before/after diffs.
export type Flat = Record<string, unknown>
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function flatten(obj: unknown, prefix = '', out: Flat = {}): Flat {
  if (!isPlain(obj)) { if (prefix) out[prefix] = obj; return out }
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (isPlain(v)) flatten(v, p, out)
    else out[p] = v
  }
  return out
}

export function unflatten(flat: Flat): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const [path, v] of Object.entries(flat)) {
    const parts = path.split('.')
    let cur = root
    parts.forEach((part, i) => {
      if (i === parts.length - 1) cur[part] = v
      else {
        if (!isPlain(cur[part])) cur[part] = {}
        cur = cur[part] as Record<string, unknown>
      }
    })
  }
  return root
}

const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v)
export const sameValue = (a: unknown, b: unknown) => JSON.stringify(blankToNull(a)) === JSON.stringify(blankToNull(b))

/** Leaves that differ between `before` and `after`. Blank strings become null so a cleared field is sent as null. */
export function changedFields(before: Flat, after: Flat): Flat {
  const out: Flat = {}
  for (const k of Object.keys(after)) if (!sameValue(before[k], after[k])) out[k] = blankToNull(after[k])
  return out
}

/** "personal.address.city" -> "Address city", "professional.team_ids" -> "Team IDs". */
export function labelOf(path: string): string {
  const parts = path.split('.')
  const last = parts[parts.length - 1]
  const parent = parts.length > 1 ? parts[parts.length - 2] : ''
  const base = ['address', 'emergency_contact'].includes(parent) ? `${parent} ${last}` : last
  const s = base.replace(/_/g, ' ').replace(/\bid\b/g, 'ID').replace(/\bids\b/g, 'IDs')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
