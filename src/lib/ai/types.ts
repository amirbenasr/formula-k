import type { Payload } from 'payload'

import type { User } from '@/payload-types'

/**
 * Payload's generated types are precise, but these helpers deliberately operate
 * on a loose document shape: the same code path handles products, variants,
 * orders, tiers and rewards, and the Local API's per-collection generics make
 * precise narrowing here costlier than it is worth.
 *
 * Keeping one alias means the escape hatch is explicit and contained in a single
 * place rather than scattered as `any` across the module — which matters because
 * lint-staged runs ESLint with `--max-warnings=0`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseDoc = Record<string, any>

/** Per-request context handed to every assistant tool. */
export type AiToolContext = {
  conversationId: string
  payload: Payload
  user: User
}

/**
 * A single row-level change the assistant wants to make. Stored on the
 * AiActionLog row while it is `pending`, and re-validated at apply time.
 */
export type PlannedChange = {
  from: number
  label: string
  productId: number
  targetId: number
  targetKind: 'product' | 'variant'
  to: number
}

export const money = (value: unknown): string =>
  typeof value === 'number' ? `$${value.toFixed(2)}` : '—'
