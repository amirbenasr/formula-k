import { describe, it, expect } from 'vitest'
import { adminOrPublishedStatus } from '../adminOrPublishedStatus'

import type { Access } from 'payload'

const mockArgs = (user: unknown) => ({ req: { user } }) as unknown as Parameters<Access>[0]

describe('adminOrPublishedStatus', () => {
  it('returns true for admin user', () => {
    expect(adminOrPublishedStatus(mockArgs({ id: 1, roles: ['admin'] }))).toBe(true)
  })

  it('returns published status filter for guest', () => {
    const result = adminOrPublishedStatus(mockArgs(null))
    expect(result).toEqual({ _status: { equals: 'published' } })
  })

  it('returns published status filter for customer', () => {
    const result = adminOrPublishedStatus(mockArgs({ id: 2, roles: ['customer'] }))
    expect(result).toEqual({ _status: { equals: 'published' } })
  })
})
