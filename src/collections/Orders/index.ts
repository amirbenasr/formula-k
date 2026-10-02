import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import type { Field } from 'payload'

import { syncInventoryWithOrderStatus } from './hooks/syncInventory'

const STATUS_DESCRIPTION =
  'Cancelling or refunding an order puts its items back in stock. Reopening the order takes them out again.'

/** A structural view of a field, so the status select can be patched without a union dance. */
type LooseField = { admin?: Record<string, unknown>; name?: string }

/**
 * The stock movement is invisible from the admin panel — set a status and units
 * quietly appear or disappear elsewhere. Saying so on the control that triggers
 * it is the whole documentation most admins will ever read.
 *
 * Presentation only: `admin.description` is not part of the database schema, so
 * this needs no migration.
 */
export const describeStatusField = (fields: Field[]): Field[] =>
  (fields as unknown as LooseField[]).map((field) => {
    if (field.name !== 'status') return field as unknown as Field

    return {
      ...field,
      admin: { ...field.admin, description: STATUS_DESCRIPTION },
    } as unknown as Field
  })

/**
 * The ecommerce plugin builds `orders` with no hooks of its own (its only stock
 * write is the decrement in the payment confirm-order endpoint, which this
 * project does not use), so this override exists to add exactly one: restoring
 * product/variant stock when an order is cancelled or refunded, and reserving it
 * again if the order is reopened.
 *
 * The fields and hooks of the default collection are spread back in, so a future
 * plugin version that adds one keeps working.
 *
 * See ./inventory.ts for the behaviour and why it is idempotent.
 */
export const OrdersCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  fields: describeStatusField(defaultCollection.fields),
  hooks: {
    ...defaultCollection.hooks,
    afterChange: [...(defaultCollection.hooks?.afterChange ?? []), syncInventoryWithOrderStatus],
  },
})
