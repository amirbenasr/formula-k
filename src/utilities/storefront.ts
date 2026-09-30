import type { Product } from '@/payload-types'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import type { ProductCardProduct } from '@/components/ProductCard'
import { CACHE_TAGS } from '@/utilities/cacheTags'

/**
 * Fields every product tile needs. Keeping `select` tight keeps the homepage fast
 * and avoids shipping whole rich-text documents to the browser.
 */
export const productCardSelect = {
  title: true,
  slug: true,
  brand: true,
  gallery: true,
  priceInUSD: true,
  inventory: true,
  enableVariants: true,
  variants: true,
  createdAt: true,
} as const

/** Only published products are queried; photo presence is checked in memory below
 *  because the Postgres adapter cannot use `exists` on the `gallery` array. */
const publishedFilter = (): Where[] => [{ _status: { equals: 'published' } }]

const publishedAndBuyable: Where = { and: publishedFilter() }

/** A product tile without a photo is not sellable in a product-first storefront. */
function hasPhoto(product: { gallery?: Product['gallery'] }): boolean {
  const image = product.gallery?.[0]?.image
  return Boolean(image && typeof image === 'object' && image.url)
}

export type CategoryWithPreview = {
  id: number | string
  title: string
  slug: string
  imageUrl?: string
  imageAlt?: string
  productCount: number
}

/**
 * Latest published, in-stock products — the base feed for the hero tiles,
 * "Nouveautés" rail and as a fallback when there is no sales history yet.
 */
export async function getFreshProducts(
  payload: Payload,
  limit = 12,
  options: { inStockOnly?: boolean } = {},
): Promise<ProductCardProduct[]> {
  const { inStockOnly = true } = options

  // Over-fetch so that products without a photo can be dropped without
  // handing back a short list.
  const { docs } = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    depth: 1,
    limit: limit * 2,
    sort: '-createdAt',
    select: productCardSelect,
    where: inStockOnly
      ? { and: [...publishedFilter(), { inventory: { greater_than: 0 } }] }
      : publishedAndBuyable,
  })

  return (docs as ProductCardProduct[]).filter(hasPhoto).slice(0, limit)
}

/**
 * Real best sellers, aggregated from the orders collection (no schema additions).
 * Returns an empty array when the shop has no sales yet so callers can fall back
 * to a merchandised selection instead of inventing a ranking.
 */
export async function getBestSellers(payload: Payload, limit = 8): Promise<ProductCardProduct[]> {
  const { docs: orders } = await payload.find({
    collection: 'orders',
    // Orders are not publicly readable — this is a server-side aggregate that
    // returns only product ids and counts, never customer data.
    overrideAccess: true,
    depth: 0,
    limit: 500,
    sort: '-createdAt',
    pagination: false,
    select: { items: true, status: true },
  })

  const unitsSold = new Map<string, number>()

  for (const order of orders) {
    // Only orders that actually represent a sale count towards the ranking.
    if (order.status === 'cancelled' || order.status === 'refunded') {
      continue
    }

    for (const item of order.items ?? []) {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      if (!productID) continue
      const key = String(productID)
      unitsSold.set(key, (unitsSold.get(key) ?? 0) + (item.quantity || 1))
    }
  }

  const rankedIDs = [...unitsSold.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, limit)

  if (rankedIDs.length === 0) return []

  const { docs } = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    depth: 1,
    limit: rankedIDs.length,
    pagination: false,
    select: productCardSelect,
    where: {
      and: [...publishedFilter(), { id: { in: rankedIDs } }],
    },
  })

  const byID = new Map(
    (docs as ProductCardProduct[]).filter(hasPhoto).map((doc) => [String(doc.id), doc]),
  )

  // Preserve the sales ranking rather than the query order.
  return rankedIDs.map((id) => byID.get(id)).filter((doc): doc is ProductCardProduct => Boolean(doc))
}

/**
 * Categories with a representative product photo and a live product count.
 * `categories` has no image field, so the preview comes from its newest product.
 */
export async function getCategoryShowcase(
  payload: Payload,
  limit = 8,
): Promise<CategoryWithPreview[]> {
  const { docs: categories } = await payload.find({
    collection: 'categories',
    overrideAccess: false,
    depth: 0,
    limit,
    sort: 'title',
    pagination: false,
  })

  if (categories.length === 0) return []

  const { docs: products } = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    depth: 1,
    limit: 300,
    sort: '-createdAt',
    pagination: false,
    select: { categories: true, gallery: true },
    where: publishedAndBuyable,
  })

  const productsWithPhotos = products.filter(hasPhoto)

  const previews = new Map<string, { url?: string; alt?: string }>()
  const counts = new Map<string, number>()

  for (const product of productsWithPhotos) {
    const image = product.gallery?.[0]?.image
    const imageObject = image && typeof image === 'object' ? image : undefined

    for (const category of product.categories ?? []) {
      const id = typeof category === 'object' ? category.id : category
      if (!id) continue
      const key = String(id)

      counts.set(key, (counts.get(key) ?? 0) + 1)

      if (!previews.has(key) && imageObject?.url) {
        previews.set(key, { url: imageObject.url, alt: imageObject.alt ?? undefined })
      }
    }
  }

  return categories.map((category) => {
    const key = String(category.id)
    const preview = previews.get(key)

    return {
      id: category.id,
      title: category.title,
      slug: category.slug ?? '',
      imageUrl: preview?.url,
      imageAlt: preview?.alt ?? category.title,
      productCount: counts.get(key) ?? 0,
    }
  })
}

export type CategoryNavItem = {
  id: number | string
  title: string
  slug: string
  productCount: number
}

/**
 * Category navigation for the header. Cached because it renders on every page;
 * revalidate the `categories` tag when the catalogue changes.
 */
export const getCachedCategoryNav = unstable_cache(
  async (limit = 12): Promise<CategoryNavItem[]> => {
    const payload = await getPayload({ config })

    const { docs: categories } = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      depth: 0,
      limit,
      sort: 'title',
      pagination: false,
    })

    if (categories.length === 0) return []

    const { docs: products } = await payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      depth: 0,
      limit: 500,
      pagination: false,
      select: { categories: true },
      where: { _status: { equals: 'published' } },
    })

    const counts = new Map<string, number>()

    for (const product of products) {
      for (const category of product.categories ?? []) {
        const id = typeof category === 'object' ? category.id : category
        if (!id) continue
        const key = String(id)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }

    return categories.map((category) => ({
      id: category.id,
      title: category.title,
      slug: category.slug ?? '',
      productCount: counts.get(String(category.id)) ?? 0,
    }))
  },
  ['storefront-category-nav'],
  { revalidate: 3600, tags: [CACHE_TAGS.categories] },
)

/**
 * Cached storefront feeds.
 *
 * Every read below is created inside the cached function (a Payload instance is
 * not serializable and must not be a cache key), and every read declares the
 * tags that the Payload hooks invalidate on save. The `revalidate` windows are
 * safety nets, not the primary invalidation path.
 */
export const getCachedFreshProducts = unstable_cache(
  async (limit = 12, inStockOnly = true): Promise<ProductCardProduct[]> => {
    const payload = await getPayload({ config })

    return getFreshProducts(payload, limit, { inStockOnly })
  },
  ['storefront-fresh-products'],
  { revalidate: 3600, tags: [CACHE_TAGS.products] },
)

/**
 * Best sellers scan the order history, so they are cached for longer than the
 * rest of the catalogue and refreshed whenever an order is written.
 */
export const getCachedBestSellers = unstable_cache(
  async (limit = 8): Promise<ProductCardProduct[]> => {
    const payload = await getPayload({ config })

    return getBestSellers(payload, limit)
  },
  ['storefront-best-sellers'],
  { revalidate: 600, tags: [CACHE_TAGS.products, CACHE_TAGS.orders] },
)

export const getCachedCategoryShowcase = unstable_cache(
  async (limit = 8): Promise<CategoryWithPreview[]> => {
    const payload = await getPayload({ config })

    return getCategoryShowcase(payload, limit)
  },
  ['storefront-category-showcase'],
  { revalidate: 3600, tags: [CACHE_TAGS.products, CACHE_TAGS.categories] },
)

/** Brand directory + homepage brand strip, with logos populated. */
export const getCachedBrands = unstable_cache(
  async (limit = 200) => {
    const payload = await getPayload({ config })

    const { docs, totalDocs } = await payload.find({
      collection: 'brands',
      depth: 1,
      limit,
      overrideAccess: false,
      pagination: false,
      sort: 'title',
    })

    return { docs, totalDocs }
  },
  ['storefront-brands'],
  { revalidate: 3600, tags: [CACHE_TAGS.brands] },
)

/** Products flagged for the homepage video showcase (videos already attached). */
export const getCachedVideoShowcaseProducts = unstable_cache(
  async (limit = 12): Promise<Product[]> => {
    const payload = await getPayload({ config })

    const { docs } = await payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      depth: 2,
      limit,
      where: {
        and: [{ _status: { equals: 'published' } }, { featuredInVideoShowcase: { equals: true } }],
      },
    })

    return docs
  },
  ['storefront-video-showcase'],
  { revalidate: 3600, tags: [CACHE_TAGS.products] },
)

/**
 * Accent-insensitive text search.
 *
 * Shoppers type "creme" or "serum", not "Crème" or "Sérum". Postgres ILIKE is
 * accent-sensitive (and cannot search the richText `description` at all), so for
 * a catalogue of this size we keep a short-lived search index and match on a
 * normalised string instead. Falls back to a plain query for huge catalogues.
 *
 * The index lives in Next's data cache rather than in module state: on Vercel
 * each serverless instance used to rebuild it independently, so a cold start
 * paid the full catalogue query before it could answer one keystroke.
 */
const SEARCH_INDEX_MAX = 2000

type SearchIndexItem = {
  product: ProductCardProduct
  haystack: string
}

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const getSearchIndex = unstable_cache(
  async (): Promise<SearchIndexItem[]> => {
    const payload = await getPayload({ config })

    const { docs, totalDocs } = await payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      depth: 1,
      limit: SEARCH_INDEX_MAX,
      pagination: false,
      sort: '-createdAt',
      select: productCardSelect,
      where: publishedAndBuyable,
    })

    // A catalogue larger than the index window must go through the database.
    if (totalDocs > SEARCH_INDEX_MAX) return []

    return (docs as ProductCardProduct[]).filter(hasPhoto).map((product) => {
      const brand = product.brand && typeof product.brand === 'object' ? product.brand.title : ''
      return {
        product,
        haystack: normalizeForSearch(`${product.title} ${brand}`),
      }
    })
  },
  ['storefront-search-index'],
  { revalidate: 300, tags: [CACHE_TAGS.products] },
)

/**
 * Returns published products matching `query`, accent- and case-insensitively.
 * Multi-word queries match when every word is present.
 */
export async function searchProductCatalog(
  query: string,
  limit = 8,
): Promise<ProductCardProduct[]> {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const index = await getSearchIndex()
  if (index.length === 0) return []

  const matches = index.filter((item) => terms.every((term) => item.haystack.includes(term)))

  // Title-prefix matches first, then the shortest (most specific) titles.
  const first = terms[0]
  matches.sort((a, b) => {
    const aStarts = normalizeForSearch(a.product.title).startsWith(first) ? 0 : 1
    const bStarts = normalizeForSearch(b.product.title).startsWith(first) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return a.product.title.length - b.product.title.length
  })

  return matches.slice(0, limit).map((item) => item.product)
}
