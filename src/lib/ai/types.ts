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
 * A single row-level stock change. Stored on the AiActionLog row while it is
 * `pending`, and re-validated at apply time.
 */
export type PlannedChange = {
  from: number
  label: string
  productId: number
  targetId: number
  targetKind: 'product' | 'variant'
  to: number
}

/**
 * Which family of write a staged action belongs to.
 *
 * The assistant grew from "stock only" to "the whole catalogue", so a staged row
 * now describes one of several shapes. Keeping the discriminator on the row
 * (rather than inferring it from the payload) means apply-time dispatch is
 * explicit and an unknown kind fails loudly instead of being misread.
 */
export type ActionKind = 'brand' | 'inventory' | 'product'

/** `op` values that create, edit or retitle a brand. */
export type BrandOperation = 'create' | 'update'

/**
 * The three states the assistant can move a product between.
 *
 * `archive` is deliberately not a delete: Payload's trash makes a delete
 * recoverable, but removing a row still pulls it out of historical orders and
 * reports. Draft is reversible and already invisible on the storefront.
 */
export type ProductOperation = 'archive' | 'create' | 'publish' | 'update'

/** `op` values that create or edit a product. */
export type ProductWriteOperation = 'create' | 'update'

/** A single field edit shown as `from → to` in the approval UI. */
export type FieldDiff = {
  /** Existing value, absent on a create. */
  from?: unknown
  label: string
  /** Value that will be written on approval. */
  to: unknown
}

/**
 * One product/brand write as staged. `fields` is the already-validated data
 * handed verbatim to the Local API on approval — the model never supplies raw
 * collection data, and apply never re-interprets what the model said.
 */
export type StagedWrite = InventoryStagedWrite | CatalogueStagedWrite

/** A stock proposal: one `PlannedChange` per product or variant row. */
export type InventoryStagedWrite = {
  changes: PlannedChange[]
  targetKind: 'inventory'
}

/** A product or brand proposal. */
export type CatalogueStagedWrite = {
  fields: LooseDoc
  op: ProductOperation | BrandOperation
  /** Set for product operations. */
  slug?: string
  /** Set for brand operations. */
  title?: string
  /** Product id (products) or brand id (brands); absent on create. */
  targetId?: number
  targetKind: 'brand' | 'product'
}

/**
 * What was actually written for one staged action, recorded on the log row so
 * the audit trail stores the result rather than the intention.
 */
export type AppliedWrite = {
  /** Set for create operations. */
  id?: number | string
  label: string
  op: ProductOperation | BrandOperation
  /** Set for publish/archive so the UI can show the resulting state. */
  status?: 'draft' | 'published'
}

export const money = (value: unknown): string =>
  typeof value === 'number' ? `$${value.toFixed(2)}` : '—'
