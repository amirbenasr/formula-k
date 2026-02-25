import { describe, it, expect } from 'vitest'
import { canUseDOM } from '../canUseDOM'

describe('canUseDOM', () => {
  it('returns true in jsdom environment', () => {
    expect(canUseDOM).toBe(true)
  })

  it('is a boolean', () => {
    expect(typeof canUseDOM).toBe('boolean')
  })
})
