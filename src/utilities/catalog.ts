import type { Brand, Category, Product } from '@/payload-types'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { CACHE_TAGS } from '@/utilities/cacheTags'
import { productCardSelect } from '@/utilities/storefront'

/**
 * Catalog reads shared by the listing pages.
 *
 * Listing routes (`/shop`, `/shop/[slug]`, `/brands/[slug]`) read `searchParams`
 * for pagination and sorting, which Next renders dynamically. Caching the query
 * per unique filter combination is what keeps those pages from paying a
 * database round trip on every request — the value of the cache here is that
 * the database lives in a different region than the Vercel function.
 */
export type CatalogQuery = {
  page: number
  pageSize: number
  sort?: string
  categoryID?: number | string
  brandID?: number | string
  search?: string
}

export const getCachedCatalogProducts = unstable_cache(
  async ({ page, pageSize, sort, categoryID, brandID, search }: CatalogQuery) => {
    const payload = await getPayload({ config })

    return payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      limit: pageSize,
      page,
      select: productCardSelect,
      ...(sort ? { sort } : { sort: 'title' }),
      where: {
        and: [
          { _status: { equals: 'published' } },
          // `?category=` (present but empty) must behave like "no filter", which
          // is what the previous inline query did.
          ...(categoryID !== undefined && categoryID !== ''
            ? [{ categories: { contains: categoryID } }]
            : []),
          ...(brandID !== undefined && brandID !== '' ? [{ brand: { equals: brandID } }] : []),
          ...(search
            ? [
                {
                  // `description` is richText (jsonb): `like` on it is invalid SQL
                  // on Postgres, so only the title and brand are matched here.
                  or: [
                    { title: { like: search } },
                    { 'brand.title': { like: search } },
                  ],
                },
              ]
            : []),
        ],
      },
    })
  },
  ['storefront-catalog-products'],
  { revalidate: 3600, tags: [CACHE_TAGS.products] },
)

/** Accent-insensitive fallback used when the SQL `like` above finds nothing. */
export const getCachedCategoryBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<Category | null> => {
      const payload = await getPayload({ config })

      const { docs } = await payload.find({
        collection: 'categories',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: false,
      })

      return docs[0] ?? null
    },
    ['storefront-category-by-slug', slug],
    { revalidate: 3600, tags: [CACHE_TAGS.categories, CACHE_TAGS.category(slug)] },
  )()

export const getCachedBrandBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<Brand | null> => {
      const payload = await getPayload({ config })

      const { docs } = await payload.find({
        collection: 'brands',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 1,
        overrideAccess: false,
      })

      return docs[0] ?? null
    },
    ['storefront-brand-by-slug', slug],
    { revalidate: 3600, tags: [CACHE_TAGS.brands, CACHE_TAGS.brand(slug)] },
  )()

/**
 * Published product for a detail page, with the same depth/populate shape the
 * page has always requested. Draft previews bypass this: Next skips
 * `unstable_cache` entirely while draft mode is enabled, and the page queries
 * the draft-aware path instead.
 */
export const getCachedProductBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<Product | null> => {
      const payload = await getPayload({ config })

      const result = await payload.find({
        collection: 'products',
        depth: 3,
        draft: false,
        limit: 1,
        overrideAccess: false,
        pagination: false,
        where: {
          and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }],
        },
        populate: {
          variants: {
            title: true,
            priceInUSD: true,
            inventory: true,
            options: true,
          },
        },
      })

      return result.docs?.[0] ?? null
    },
    ['storefront-product-by-slug', slug],
    { revalidate: 3600, tags: [CACHE_TAGS.products, CACHE_TAGS.product(slug)] },
  )()

/**
 * Slugs prerendered by `generateStaticParams`. Returns an empty list instead of
 * throwing so a database hiccup during a production build degrades to on-demand
 * generation rather than failing the whole deploy.
 */
export async function getProductSlugs(): Promise<string[]> {
  try {
    const payload = await getPayload({ config })

    const { docs } = await payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      limit: 1000,
      pagination: false,
      select: { slug: true },
      where: { _status: { equals: 'published' } },
    })

    return docs.map((doc) => doc.slug).filter((slug): slug is string => Boolean(slug))
  } catch {
    return []
  }
}

export async function getBrandSlugs(): Promise<string[]> {
  try {
    const payload = await getPayload({ config })

    const { docs } = await payload.find({
      collection: 'brands',
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: { slug: true },
    })

    return docs.map((doc) => doc.slug).filter((slug): slug is string => Boolean(slug))
  } catch {
    return []
  }
}
