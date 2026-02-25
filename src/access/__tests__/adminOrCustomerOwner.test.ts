import { describe, it, expect } from 'vitest'
import { adminOrCustomerOwner } from '../adminOrCustomerOwner'

import type { Access } from 'payload'

const mockArgs = (user: unknown) => ({ req: { user } }) as unknown as Parameters<Access>[0]

describe('adminOrCustomerOwner', () => {
  it('returns true for admin user', () => {
    expect(adminOrCustomerOwner(mockArgs({ id: 1, roles: ['admin'] }))).toBe(true)
  })

  it('returns a where query for customer user', () => {
    const result = adminOrCustomerOwner(mockArgs({ id: 42, roles: ['customer'] }))
    expect(result).toEqual({ customer: { equals: 42 } })
  })

  it('returns false when no user (guest)', () => {
    expect(adminOrCustomerOwner(mockArgs(null))).toBe(false)
  })
})
