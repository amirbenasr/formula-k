import { searchProductCatalog } from '@/utilities/storefront'
import config from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type SearchResult = {
  id: number
  title: string
  slug: string
  price?: number
  imageUrl?: string
  soldOut: boolean
  requiresVariant: boolean
}

/**
 * Lightweight product search used by the header type-ahead.
 * Public read-only: access control is enforced with `overrideAccess: false`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') || '').trim()
  const limit = Math.min(Number(searchParams.get('limit')) || 6, 12)

  if (query.length < 2) {
    return Response.json({ results: [] as SearchResult[] })
  }

  const payload = await getPayload({ config })

  const products = await searchProductCatalog(payload, query, limit)

  const results: SearchResult[] = products.map((product) => {
    const image = product.gallery?.[0]?.image
    const imageObject = image && typeof image === 'object' ? image : undefined

    return {
      id: product.id,
      title: product.title,
      slug: product.slug ?? '',
      price: product.priceInUSD ?? undefined,
      // Local media URLs are same-origin; R2 returns absolute URLs. Both work as-is.
      imageUrl: imageObject?.url ?? undefined,
      soldOut: product.inventory === 0,
      requiresVariant: Boolean(product.enableVariants),
    }
  })

  return Response.json({ results })
}
