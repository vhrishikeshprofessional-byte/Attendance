import { describe, expect, it } from 'vitest'
import { changedFields, flatten, labelOf, unflatten } from './objects'

describe('objects', () => {
  it('round-trips flatten/unflatten', () => {
    const o = { personal: { full_name: 'A', address: { city: 'X' } }, status: 'active' }
    expect(unflatten(flatten(o))).toEqual(o)
  })
  it('returns only changed leaves, blank -> null', () => {
    expect(changedFields({ a: '1', b: null, c: 'x' }, { a: '1', b: 'new', c: '' })).toEqual({ b: 'new', c: null })
  })
  it('labels paths', () => {
    expect(labelOf('personal.address.city')).toBe('Address city')
    expect(labelOf('professional.team_ids')).toBe('Team IDs')
  })
})
