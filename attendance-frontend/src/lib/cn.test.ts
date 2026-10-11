import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins and drops falsy values', () => expect(cn('a', false && 'b', undefined, 'c')).toBe('a c'))
  it('lets later tailwind classes win', () => expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4'))
  it('supports object syntax', () => expect(cn({ a: true, b: false })).toBe('a'))
})
