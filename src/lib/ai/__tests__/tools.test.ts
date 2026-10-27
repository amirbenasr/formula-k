import type { ToolSet } from 'ai'
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { User } from '@/payload-types'

import { buildTools } from '../tools'

// The stock lookup is a separate, database-backed path; these tests are about
// the catalogue read shape, so it resolves to "no variants, zero stock".
vi.mock('../resolve', () => ({
  inventoryRows: vi.fn(async () => []),
  resolveTargets: vi.fn(async () => []),
}))

type ProductDoc = {
  _status?: string
  enableVariants?: boolean
  gallery?: unknown
  id: number
  priceInUSD?: number
  slug?: string
  title: string
}

type FindProductsOutput = {
  count: number
  products: Array<{
    galleryMediaIds: number[]
    hasImage: boolean
    id: number
    imageCount: number
    primaryMediaId: number | null
    title: string
  }>
  totalMatching: number
  truncated: boolean
}

type FindProductsInput = {
  limit?: number
  lowStockBelow?: number
  missingImages?: boolean
  query?: string
}

const user = { id: 1 } as unknown as User

function fakePayload(docs: ProductDoc[], totalDocs = docs.length) {
  const find = vi.fn(async (_args: Record<string, unknown>) => ({ docs, totalDocs }))

  return { find, payload: { find } as unknown as Payload }
}

function runFindProducts(tools: ToolSet, input: FindProductsInput): Promise<FindProductsOutput> {
  const tool = tools.find_products as unknown as {
    execute: (input: FindProductsInput, options: unknown) => Promise<FindProductsOutput>
  }

  return tool.execute(input, { messages: [], toolCallId: 'test' })
}

describe('find_products', () => {
  it('audits products whose gallery has no usable image', async () => {
    const { find, payload } = fakePayload([
      {
        _status: 'published',
        enableVariants: false,
        gallery: [],
        id: 67,
        priceInUSD: 42,
        slug: 'lip-sleeping-mask',
        title: 'Lip Sleeping Mask',
      },
    ])

    const result = await runFindProducts(buildTools({ conversationId: 'c', payload, user }), {
      missingImages: true,
    })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        limit: 0,
        pagination: false,
        where: { 'gallery.image': { exists: false } },
      }),
    )

    expect(result.count).toBe(1)
    expect(result.totalMatching).toBe(1)
    expect(result.truncated).toBe(false)
    expect(result.products[0]).toMatchObject({
      galleryMediaIds: [],
      hasImage: false,
      id: 67,
      imageCount: 0,
      primaryMediaId: null,
    })
  })

  it('reports image coverage on every row of a normal search', async () => {
    const { payload } = fakePayload(
      [
        {
          _status: 'published',
          enableVariants: false,
          gallery: [{ image: 12 }, { image: 8 }],
          id: 26,
          priceInUSD: 42,
          slug: 'anua-toner',
          title: 'Anua Toner',
        },
      ],
      7,
    )

    const result = await runFindProducts(buildTools({ conversationId: 'c', payload, user }), {
      limit: 1,
    })

    expect(result.products[0]).toMatchObject({
      galleryMediaIds: [12, 8],
      hasImage: true,
      imageCount: 2,
      primaryMediaId: 12,
    })
    expect(result.totalMatching).toBe(7)
    expect(result.truncated).toBe(true)
  })

  it('counts every missing product even when the limit truncates the rows', async () => {
    const docs: ProductDoc[] = [1, 2, 3].map((id) => ({
      gallery: [],
      id,
      title: `Product ${id}`,
    }))

    const { payload } = fakePayload(docs)

    const result = await runFindProducts(buildTools({ conversationId: 'c', payload, user }), {
      limit: 2,
      missingImages: true,
    })

    expect(result.count).toBe(2)
    expect(result.totalMatching).toBe(3)
    expect(result.truncated).toBe(true)
  })
})
