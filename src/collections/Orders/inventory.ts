import type { PayloadRequest } from 'payload'

import type { Order, OrderStatus } from '@/payload-types'

/**
 * Stock control for the `orders` collection.
 *
 * Before this module, stock was moved in exactly one place: the Cash-on-Delivery
 * checkout route decremented each product/variant by hand right after creating
 * the order. Cancelling an order therefore did nothing — the units stayed
 * deducted forever, and the storefront kept reporting them as sold.
 *
 * The ecommerce plugin cannot help with the other half: its `orders` collection
 * declares no hooks at all, and its only inventory write is the decrement in the
 * `/api/payments/:method/confirm-order` endpoint, which this project never calls
 * (`payments: undefined`, COD only). So both directions are ours to own.
 *
 * ## Why this lives in a hook
 *
 * Keeping the status and the stock in the same write is what makes the two
 * impossible to disagree: the mutation is applied from the `afterChange` hook
 * with the operation's `req`, so an order status change and the stock it implies
 * commit or roll back together. Today an order can only be created or edited
 * through the admin panel or the Local API, so every path goes through the hook.
 *
 * ## Idempotency
 *
 * The hook never counts. `planInventorySync` derives what to do from the
 * *transition* between two persisted facts — the status the order had before the
 * write and the status it has after it — so the stock movement is a function of
 * the order's state, not of how many times a hook happened to run:
 *
 * - Saving the same status again (`cancelled` → `cancelled`) plans nothing, so a
 *   re-save, a double submit or a retried request can never restock twice.
 * - Reopening a cancelled order (`cancelled` → `processing`) takes the units back
 *   out, so cancelling it again restocks exactly once rather than twice.
 *
 * The stock itself is written as a plain number read from the database, which is
 * the same thing the old checkout code did. Two admins flipping the status of the
 * *same* order at the same instant is the one interleaving this cannot serialise;
 * independent orders touching the same product are applied one after the other.
 */

/**
 * Statuses that mean the goods are no longer committed to a customer: a
 * cancelled order is never shipped, and a refunded one has been returned.
 *
 * `refunded` restocks too, because in this store a refund means the parcel came
 * back. Remove it from this list if refunds here are ever issued for money alone
 * (a price adjustment, say) without the goods returning.
 */
export const RELEASED_ORDER_STATUSES = ['cancelled', 'refunded'] as const

/** What a write to an order should do to the stock of the products it contains. */
export type InventoryEffect = 'deduct' | 'restore'

const isReleased = (status: OrderStatus | undefined): boolean =>
  status != null && (RELEASED_ORDER_STATUSES as readonly string[]).includes(status)

/**
 * The whole decision, as a pure function of the order's before/after state.
 *
 * Returns `null` when the write must not touch stock — which is the normal case
 * for an edit that leaves the status alone, and is what makes re-running the hook
 * harmless.
 */
export function planInventorySync({
  nextStatus,
  operation,
  previousStatus,
}: {
  nextStatus: OrderStatus | undefined
  operation: 'create' | 'update'
  previousStatus: OrderStatus | undefined
}): InventoryEffect | null {
  const nextReleased = isReleased(nextStatus)

  if (operation === 'create') {
    // A new order holds stock from the moment it exists... unless it is born
    // already cancelled, in which case nothing was ever committed.
    return nextReleased ? null : 'deduct'
  }

  // No transition: the units are already where the status says they should be.
  if (isReleased(previousStatus) === nextReleased) return null

  return nextReleased ? 'restore' : 'deduct'
}

/** One stock row to move, with repeat rows for the same product already summed. */
export type StockTarget = {
  collection: 'products' | 'variants'
  id: number
  quantity: number
}

/** A relationship is an id or a populated document, depending on the query depth. */
function referenceID(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
  }

  return null
}

/** Quantities are `min: 1` in the schema; anything else is not stock movement. */
function wholeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0

  return Math.max(0, Math.trunc(value))
}

/**
 * Turns order rows into one movement per product/variant.
 *
 * The same variant can legitimately appear on two rows of one order; summing
 * them here means the database sees a single read-modify-write per target, so
 * the two rows can never overwrite each other's arithmetic.
 *
 * The variant wins when both are set: with variants enabled, per-variant stock
 * is the real one, and the product's `inventory` field is hidden in the admin.
 */
export function collectStockTargets(items: Order['items']): StockTarget[] {
  const targets = new Map<string, StockTarget>()

  for (const item of items ?? []) {
    const quantity = wholeQuantity(item?.quantity)
    if (quantity === 0) continue

    const variantID = referenceID(item?.variant)
    const productID = referenceID(item?.product)

    const target = variantID
      ? ({ collection: 'variants', id: variantID } as const)
      : productID
        ? ({ collection: 'products', id: productID } as const)
        : null

    // A row with neither a product nor a variant cannot be stocked.
    if (!target) continue

    const key = `${target.collection}:${target.id}`
    const existing = targets.get(key)

    if (existing) {
      existing.quantity += quantity
    } else {
      targets.set(key, { ...target, quantity })
    }
  }

  return [...targets.values()]
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Applies one movement to one product or variant.
 *
 * Read-then-write rather than an atomic `$inc`, because the number written has
 * to respect the schema: `inventory` is `min: 0`, so a `$inc` that overshoots
 * would leave the row unreadable to every later `update` on that document.
 */
async function adjustStock({
  collection,
  effect,
  id,
  orderID,
  quantity,
  req,
}: StockTarget & { effect: InventoryEffect; orderID: number | string; req: PayloadRequest }): Promise<void> {
  const inventory =
    collection === 'variants'
      ? (
          await req.payload.findByID({
            collection: 'variants',
            depth: 0,
            id,
            req,
            select: { inventory: true },
          })
        ).inventory
      : (
          await req.payload.findByID({
            collection: 'products',
            depth: 0,
            id,
            req,
            select: { inventory: true },
          })
        ).inventory

  /**
   * A null/undefined count means the row is not stock-tracked. Leaving it alone
   * in both directions is what keeps this from inventing stock: a product that
   * never lost units can never gain them back.
   */
  if (typeof inventory !== 'number' || !Number.isFinite(inventory)) return

  /**
   * Reserving more than is left is clamped rather than refused: `inventory` is
   * `min: 0`, so writing the negative count would fail validation and take the
   * whole order write down with it — leaving an admin unable to reopen or cancel
   * an order because of one short line. The shortfall is logged instead, and it
   * should be rare: checkout refuses to sell more than the stock it checked.
   */
  if (effect === 'deduct' && inventory < quantity) {
    req.payload.logger.warn(
      `[orders] order ${orderID}: ${collection}:${id} is short of stock — reserving ` +
        `${quantity} with only ${inventory} left, clamped at 0`,
    )
  }

  const next = effect === 'restore' ? inventory + quantity : Math.max(0, inventory - quantity)

  if (next === inventory) return

  if (collection === 'variants') {
    await req.payload.update({ collection: 'variants', data: { inventory: next }, id, req })
  } else {
    await req.payload.update({ collection: 'products', data: { inventory: next }, id, req })
  }

  req.payload.logger.info(
    `[orders] order ${orderID}: ${effect === 'restore' ? 'restocked' : 'reserved'} ${quantity} × ${collection}:${id} (${inventory} → ${next})`,
  )
}

/**
 * Moves every target of an order, best effort.
 *
 * A failure on one row is logged and the rest still run: the usual cause is a
 * product that has since been hard-deleted, and a dangling line in an old order
 * must not be able to block a cancellation.
 */
export async function applyInventoryEffect({
  effect,
  items,
  orderID,
  req,
}: {
  effect: InventoryEffect
  items: Order['items']
  orderID: number | string
  req: PayloadRequest
}): Promise<void> {
  for (const target of collectStockTargets(items)) {
    try {
      await adjustStock({ ...target, effect, orderID, req })
    } catch (error) {
      req.payload.logger.warn(
        `[orders] order ${orderID}: could not ${effect === 'restore' ? 'restock' : 'reserve'} ` +
          `${target.quantity} × ${target.collection}:${target.id} — ${describeError(error)}`,
      )
    }
  }
}
