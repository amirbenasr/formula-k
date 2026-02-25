import { describe, it, expect } from 'vitest'
import { capitaliseFirstLetter } from '../capitaliseFirstLetter'

describe('capitaliseFirstLetter', () => {
  it('capitalises the first letter of a string', () => {
    expect(capitaliseFirstLetter('hello')).toBe('Hello')
  })

  it('returns empty string for empty input', () => {
    expect(capitaliseFirstLetter('')).toBe('')
  })

  it('handles single character', () => {
    expect(capitaliseFirstLetter('a')).toBe('A')
  })

  it('does not change already capitalised strings', () => {
    expect(capitaliseFirstLetter('Hello')).toBe('Hello')
  })

  it('only capitalises the first letter', () => {
    expect(capitaliseFirstLetter('hello world')).toBe('Hello world')
  })
})
