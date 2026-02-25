import { describe, it, expect } from 'vitest'
import { ensureStartsWith } from '../ensureStartsWith'

describe('ensureStartsWith', () => {
  it('adds prefix when string does not start with it', () => {
    expect(ensureStartsWith('world', 'hello-')).toBe('hello-world')
  })

  it('does not duplicate prefix when string already starts with it', () => {
    expect(ensureStartsWith('/path', '/')).toBe('/path')
  })

  it('adds slash prefix', () => {
    expect(ensureStartsWith('path', '/')).toBe('/path')
  })

  it('handles empty prefix', () => {
    expect(ensureStartsWith('hello', '')).toBe('hello')
  })
})
