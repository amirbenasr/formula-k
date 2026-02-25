import { describe, it, expect } from 'vitest'
import { isAdmin } from '../isAdmin'

import type { Access } from 'payload'

const mockArgs = (user: unknown) => ({ req: { user } }) as unknown as Parameters<Access>[0]

describe('isAdmin', () => {
  it('returns true for admin user', () => {
    expect(isAdmin(mockArgs({ id: 1, roles: ['admin'] }))).toBe(true)
  })

  it('returns false for customer user', () => {
    expect(isAdmin(mockArgs({ id: 2, roles: ['customer'] }))).toBe(false)
  })

  it('returns false when no user (guest)', () => {
    expect(isAdmin(mockArgs(null))).toBe(false)
  })

  it('returns false when user has no roles', () => {
    expect(isAdmin(mockArgs({ id: 3, roles: [] }))).toBe(false)
  })
})
