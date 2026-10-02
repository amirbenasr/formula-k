import type { CollectionAfterChangeHook } from 'payload'

import type { Order } from '@/payload-types'

import { applyInventoryEffect, planInventorySync } from '../inventory'

/**
 * Keeps product/variant stock in step with an order's status.
 *
 * `afterChange` rather than `beforeChange`: the hook must only run for a write
 * that actually happened, so a rejected edit (a validation error, a failed
 * access check) can never move stock. It is still atomic with the write — every
 * Local API call made here is handed the same `req`, so the status change and
 * the stock movement share one transaction and roll back together.
 *
 * Set `context: { skipInventorySync: true }` on an order update to bypass it,
 * which is the escape hatch for a deliberate manual stock correction.
 */
export const syncInventoryWithOrderStatus: CollectionAfterChangeHook = async ({
  context,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (context?.skipInventorySync) return doc

  const order = doc as Order
  const previousOrder = previousDoc as Order | undefined

  const effect = planInventorySync({
    nextStatus: order?.status,
    operation,
    previousStatus: previousOrder?.status,
  })

  if (!effect) return doc

  await applyInventoryEffect({
    effect,
    items: order?.items,
    orderID: order?.id ?? 'unknown',
    req,
  })

  return doc
}
