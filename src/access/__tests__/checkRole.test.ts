import { describe, it, expect } from 'vitest'
import { checkRole } from '../utilities'

import type { User } from '@/payload-types'

const adminUser = { id: 1, roles: ['admin'] } as unknown as User
const customerUser = { id: 2, roles: ['customer'] } as unknown as User
const multiRoleUser = { id: 3, roles: ['admin', 'customer'] } as unknown as User

describe('checkRole', () => {
  it('returns true when user has the admin role', () => {
    expect(checkRole(['admin'], adminUser)).toBe(true)
  })

  it('returns true when user has the customer role', () => {
    expect(checkRole(['customer'], customerUser)).toBe(true)
  })

  it('returns false when user does not have the required role', () => {
    expect(checkRole(['admin'], customerUser)).toBe(false)
  })

  it('returns true when user has one of multiple checked roles', () => {
    expect(checkRole(['admin'], multiRoleUser)).toBe(true)
    expect(checkRole(['customer'], multiRoleUser)).toBe(true)
  })

  it('returns false when user is null', () => {
    expect(checkRole(['admin'], null)).toBe(false)
  })

  it('returns false when user is undefined', () => {
    expect(checkRole(['admin'], undefined)).toBe(false)
  })

  it('returns false with empty roles array', () => {
    expect(checkRole([], adminUser)).toBe(false)
  })
})
