import { describe, it, expect } from 'vitest'
import { publicAccess } from '../publicAccess'

import type { Access } from 'payload'

describe('publicAccess', () => {
  it('always returns true', () => {
    expect(publicAccess({} as unknown as Parameters<Access>[0])).toBe(true)
  })

  it('returns true regardless of arguments', () => {
    expect(publicAccess({ req: { user: null } } as unknown as Parameters<Access>[0])).toBe(true)
    expect(
      publicAccess({
        req: { user: { id: 1, roles: ['admin'] } },
      } as unknown as Parameters<Access>[0]),
    ).toBe(true)
  })
})
