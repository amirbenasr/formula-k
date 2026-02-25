import { describe, it, expect } from 'vitest'
import { adminOrSelf } from '../adminOrSelf'

import type { Access } from 'payload'

const mockArgs = (user: unknown) => ({ req: { user } }) as unknown as Parameters<Access>[0]

describe('adminOrSelf', () => {
  it('returns true for admin user', () => {
    expect(adminOrSelf(mockArgs({ id: 1, roles: ['admin'] }))).toBe(true)
  })

  it('returns a where query for customer (self access)', () => {
    const result = adminOrSelf(mockArgs({ id: 42, roles: ['customer'] }))
    expect(result).toEqual({ id: { equals: 42 } })
  })

  it('returns false when no user (guest)', () => {
    expect(adminOrSelf(mockArgs(null))).toBe(false)
  })
})
