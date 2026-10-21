import { checkRole } from '@/access/utilities'
import type { User } from '@/payload-types'
import { APIError, type PayloadRequest } from 'payload'

/**
 * Every assistant route is admin-only.
 *
 * Custom Payload endpoints are unauthenticated by default, so each handler calls
 * this first. It returns the narrowed user so the handler does not have to cast
 * (and cannot accidentally use `req.user` unchecked afterwards).
 */
export function requireAssistantAdmin(req: PayloadRequest): User {
  const user = req.user

  if (!user || !checkRole(['admin'], user as User)) {
    throw new APIError('Unauthorized — the AI assistant is restricted to admins.', 401)
  }

  return user as User
}
