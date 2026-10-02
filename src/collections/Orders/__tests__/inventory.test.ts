import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { Order } from '@/payload-types'

import { collectStockTargets, planInventorySync } from '../inventory'
import { syncInventoryWithOrderStatus } from '../hooks/syncInventory'

/**
 * The stock the hook reads and writes, keyed `collection:id`.
 *
 * The fake mirrors the shape of the real thing closely enough to be meaningful:
 * `inventory` can be null (a row that is not stock-tracked), an unknown id makes
 * `findByID` throw the way Payload's `NotFound` does, and every write goes
 * through `update` so the recorded call list proves what was written, how often,
 * and in what order.
 */
type FakeStock = Record<string, { inventory: number | null }>

type StockWrite = { collection: string; id: number; inventory: number }

const key = (collection: string, id: number) => `${collection}:${id}`

function fakeRequest(stock: FakeStock) {
  const writes: StockWrite[] = []
  const warn = vi.fn()

  const payload = {
    findByID: async ({ collection, id }: { collection: string; id: number }) => {
      const doc = stock[key(collection, id)]
      if (!doc) throw new Error(`NotFound: ${key(collection, id)}`)

      return { id, inventory: doc.inventory }
    },
    logger: { info: vi.fn(), warn },
    update: async ({
      collection,
      data,
      id,
    }: {
      collection: string
      data: { inventory: number }
      id: number
    }) => {
      const doc = stock[key(collection, id)]
      if (!doc) throw new Error(`NotFound: ${key(collection, id)}`)

      doc.inventory = data.inventory
      writes.push({ collection, id, inventory: data.inventory })

      return { id, ...data }
    },
  }

  return { req: { payload } as unknown as PayloadRequest, stock, warn, writes }
}

type HookArgs = Parameters<typeof syncInventoryWithOrderStatus>[0]

const items = (...rows: { product?: number; quantity: number; variant?: number }[]): Order['items'] =>
  rows.map((row, index) => ({ id: `row-${index}`, ...row })) as Order['items']

const runHook = (args: {
  context?: Record<string, unknown>
  doc: Partial<Order>
  operation?: 'create' | 'update'
  previousDoc?: Partial<Order>
  req: PayloadRequest
}) =>
  syncInventoryWithOrderStatus({
    context: {},
    operation: 'update',
    ...args,
  } as unknown as HookArgs)

const cancelled = (req: PayloadRequest, previousStatus: Order['status'], orderItems: Order['items']) =>
  runHook({
    doc: { id: 7, items: orderItems, status: 'cancelled' },
    previousDoc: { id: 7, status: previousStatus },
    req,
  })

describe('planInventorySync', () => {
  it('reserves stock for a new order', () => {
    expect(planInventorySync({ nextStatus: 'processing', operation: 'create', previousStatus: undefined })).toBe('deduct')
    expect(planInventorySync({ nextStatus: 'completed', operation: 'create', previousStatus: undefined })).toBe('deduct')
  })

  it('reserves nothing for an order that is created already released', () => {
    expect(planInventorySync({ nextStatus: 'cancelled', operation: 'create', previousStatus: undefined })).toBeNull()
    expect(planInventorySync({ nextStatus: 'refunded', operation: 'create', previousStatus: undefined })).toBeNull()
  })

  it('restores stock when an active order is cancelled or refunded', () => {
    expect(planInventorySync({ nextStatus: 'cancelled', operation: 'update', previousStatus: 'processing' })).toBe('restore')
    expect(planInventorySync({ nextStatus: 'refunded', operation: 'update', previousStatus: 'completed' })).toBe('restore')
  })

  it('re-reserves stock when a released order is reopened', () => {
    expect(planInventorySync({ nextStatus: 'processing', operation: 'update', previousStatus: 'cancelled' })).toBe('deduct')
    expect(planInventorySync({ nextStatus: 'completed', operation: 'update', previousStatus: 'refunded' })).toBe('deduct')
  })

  it('plans nothing when the released state does not change', () => {
    // The idempotency guarantee: saving the same status twice moves nothing.
    expect(planInventorySync({ nextStatus: 'cancelled', operation: 'update', previousStatus: 'cancelled' })).toBeNull()
    expect(planInventorySync({ nextStatus: 'refunded', operation: 'update', previousStatus: 'refunded' })).toBeNull()
    expect(planInventorySync({ nextStatus: 'refunded', operation: 'update', previousStatus: 'cancelled' })).toBeNull()
  })

  it('plans nothing for an edit that does not touch the status', () => {
    expect(planInventorySync({ nextStatus: 'processing', operation: 'update', previousStatus: 'processing' })).toBeNull()
    expect(planInventorySync({ nextStatus: 'completed', operation: 'update', previousStatus: 'processing' })).toBeNull()
    expect(planInventorySync({ nextStatus: 'processing', operation: 'update', previousStatus: undefined })).toBeNull()
  })
})

describe('collectStockTargets', () => {
  it('takes the variant when a row has both, and the product otherwise', () => {
    expect(
      collectStockTargets(items({ product: 9, quantity: 1 }, { product: 9, quantity: 2, variant: 5 })),
    ).toEqual([
      { collection: 'products', id: 9, quantity: 1 },
      { collection: 'variants', id: 5, quantity: 2 },
    ])
  })

  it('sums repeat rows for the same variant into one movement', () => {
    expect(
      collectStockTargets(items({ product: 9, quantity: 2, variant: 5 }, { product: 9, quantity: 3, variant: 5 })),
    ).toEqual([{ collection: 'variants', id: 5, quantity: 5 }])
  })

  it('reads populated relationships as well as bare ids', () => {
    const populated = [
      { product: { id: 9 }, quantity: 4 },
    ] as unknown as Order['items']

    expect(collectStockTargets(populated)).toEqual([{ collection: 'products', id: 9, quantity: 4 }])
  })

  it('ignores rows with no target and quantities that are not whole positive numbers', () => {
    expect(
      collectStockTargets([
        { quantity: 2 },
        { product: null, quantity: 2 },
        { product: 9, quantity: 0 },
        { product: 9, quantity: -3 },
        { product: 9, quantity: Number.NaN },
      ] as unknown as Order['items']),
    ).toEqual([])

    expect(collectStockTargets(null)).toEqual([])
  })
})

describe('syncInventoryWithOrderStatus', () => {
  it('restores stock when an order is cancelled, exactly once', async () => {
    const { req, stock, writes } = fakeRequest({
      'products:9': { inventory: 10 },
      'variants:5': { inventory: 3 },
    })

    const orderItems = items({ product: 9, quantity: 4 }, { product: 9, quantity: 2, variant: 5 })

    await cancelled(req, 'processing', orderItems)

    expect(stock['products:9'].inventory).toBe(14)
    expect(stock['variants:5'].inventory).toBe(5)
    expect(writes).toHaveLength(2)

    // The admin saves the cancelled order again: nothing may move.
    await runHook({
      doc: { id: 7, items: orderItems, status: 'cancelled' },
      previousDoc: { id: 7, items: orderItems, status: 'cancelled' },
      req,
    })

    expect(stock['products:9'].inventory).toBe(14)
    expect(stock['variants:5'].inventory).toBe(5)
    expect(writes).toHaveLength(2)
  })

  it('reserves stock when the order is created', async () => {
    const { req, stock } = fakeRequest({ 'products:9': { inventory: 10 }, 'variants:5': { inventory: 3 } })

    await runHook({
      doc: {
        id: 7,
        items: items({ product: 9, quantity: 4 }, { product: 9, quantity: 1, variant: 5 }),
        status: 'processing',
      },
      operation: 'create',
      req,
    })

    expect(stock['products:9'].inventory).toBe(6)
    expect(stock['variants:5'].inventory).toBe(2)
  })

  it('reserves nothing for an order created already cancelled', async () => {
    const { req, stock, writes } = fakeRequest({ 'products:9': { inventory: 10 } })

    await runHook({
      doc: { id: 7, items: items({ product: 9, quantity: 4 }), status: 'cancelled' },
      operation: 'create',
      req,
    })

    expect(stock['products:9'].inventory).toBe(10)
    expect(writes).toHaveLength(0)
  })

  it('returns to the original stock across a cancel/reopen cycle', async () => {
    const { req, stock } = fakeRequest({ 'products:9': { inventory: 10 } })
    const orderItems = items({ product: 9, quantity: 4 })

    await runHook({
      doc: { id: 7, items: orderItems, status: 'processing' },
      operation: 'create',
      req,
    })
    expect(stock['products:9'].inventory).toBe(6)

    await cancelled(req, 'processing', orderItems)
    expect(stock['products:9'].inventory).toBe(10)

    await runHook({
      doc: { id: 7, items: orderItems, status: 'processing' },
      previousDoc: { id: 7, status: 'cancelled' },
      req,
    })
    expect(stock['products:9'].inventory).toBe(6)

    await cancelled(req, 'processing', orderItems)
    expect(stock['products:9'].inventory).toBe(10)
  })

  it('restocks a refunded order too', async () => {
    const { req, stock } = fakeRequest({ 'products:9': { inventory: 6 } })

    await runHook({
      doc: { id: 7, items: items({ product: 9, quantity: 4 }), status: 'refunded' },
      previousDoc: { id: 7, status: 'completed' },
      req,
    })

    expect(stock['products:9'].inventory).toBe(10)
  })

  it('leaves stock that is not tracked alone, in both directions', async () => {
    const { req, stock, writes } = fakeRequest({ 'products:9': { inventory: null } })

    await cancelled(req, 'processing', items({ product: 9, quantity: 4 }))
    await runHook({
      doc: { id: 7, items: items({ product: 9, quantity: 4 }), status: 'processing' },
      previousDoc: { id: 7, status: 'cancelled' },
      req,
    })

    expect(stock['products:9'].inventory).toBeNull()
    expect(writes).toHaveLength(0)
  })

  it('never drives stock below zero when a released order is reopened', async () => {
    const { req, stock, warn } = fakeRequest({ 'products:9': { inventory: 1 } })

    await runHook({
      doc: { id: 7, items: items({ product: 9, quantity: 4 }), status: 'processing' },
      previousDoc: { id: 7, status: 'cancelled' },
      req,
    })

    expect(stock['products:9'].inventory).toBe(0)
    expect(String(warn.mock.calls[0]?.[0])).toContain('short of stock')
  })

  it('logs and carries on when an ordered product no longer exists', async () => {
    const { req, stock, warn, writes } = fakeRequest({ 'products:9': { inventory: 6 } })

    await cancelled(
      req,
      'processing',
      items({ product: 404, quantity: 1 }, { product: 9, quantity: 4 }),
    )

    expect(stock['products:9'].inventory).toBe(10)
    expect(writes).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('products:404')
  })

  it('can be bypassed with a context flag', async () => {
    const { req, stock, writes } = fakeRequest({ 'products:9': { inventory: 6 } })

    await runHook({
      context: { skipInventorySync: true },
      doc: { id: 7, items: items({ product: 9, quantity: 4 }), status: 'cancelled' },
      previousDoc: { id: 7, status: 'processing' },
      req,
    })

    expect(stock['products:9'].inventory).toBe(6)
    expect(writes).toHaveLength(0)
  })
})
