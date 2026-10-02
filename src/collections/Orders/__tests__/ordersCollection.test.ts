import type { CollectionConfig, CollectionAfterChangeHook, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { OrdersCollection, describeStatusField } from '../index'

/** The shape the ecommerce plugin's `createOrdersCollection` produces. */
const existingHook = (async () => undefined) as unknown as CollectionAfterChangeHook

const defaultCollection = (): CollectionConfig =>
  ({
    slug: 'orders',
    fields: [
      { name: 'items', type: 'array', fields: [{ name: 'quantity', type: 'number' }] },
      {
        name: 'status',
        type: 'select',
        admin: { position: 'sidebar' },
        defaultValue: 'processing',
        options: [
          { label: 'Processing', value: 'processing' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
    ],
    hooks: { afterChange: [existingHook] },
  }) as unknown as CollectionConfig

const fieldNamed = (fields: Field[], name: string) =>
  fields.find((field) => (field as { name?: string }).name === name) as
    | { admin?: { description?: string; position?: string } }
    | undefined

describe('OrdersCollection', () => {
  it('appends its hook to the ones the plugin already registered', async () => {
    const collection = await OrdersCollection({ defaultCollection: defaultCollection() })
    const hooks = (collection.hooks?.afterChange ?? []) as unknown[]

    expect(hooks).toHaveLength(2)
    expect(hooks[0]).toBe(existingHook)
    expect(hooks[1]).toBeTypeOf('function')
  })

  it('leaves the rest of the collection alone', async () => {
    const collection = await OrdersCollection({ defaultCollection: defaultCollection() })

    expect(collection.slug).toBe('orders')
    expect(collection.fields).toHaveLength(2)
  })

  it('warns on the status field without losing its own admin options', async () => {
    const collection = await OrdersCollection({ defaultCollection: defaultCollection() })
    const status = fieldNamed(collection.fields, 'status')

    expect(status?.admin?.description).toContain('back in stock')
    expect(status?.admin?.position).toBe('sidebar')
    expect(fieldNamed(collection.fields, 'items')?.admin?.description).toBeUndefined()
  })
})

describe('describeStatusField', () => {
  it('returns the given fields untouched when there is no status field', () => {
    const fields = [{ name: 'items', type: 'array', fields: [] }] as unknown as Field[]

    expect(describeStatusField(fields)).toEqual(fields)
  })

  it('does not mutate the fields it is given', () => {
    const fields = defaultCollection().fields
    const before = JSON.stringify(fields)

    describeStatusField(fields)

    expect(JSON.stringify(fields)).toBe(before)
  })
})
