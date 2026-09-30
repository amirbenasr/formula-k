/**
 * Cache tags shared by the storefront data cache and the Payload hooks that
 * invalidate it.
 *
 * Every `unstable_cache(...)` call in the storefront declares the tags it
 * depends on; every collection/global hook revalidates the matching tags. Keep
 * both sides reading from this file so a rename can never silently orphan a
 * cache entry.
 */
export const CACHE_TAGS = {
  /** Any write to a product: lists, rails, detail pages. */
  products: 'products',
  /** A single product detail page. */
  product: (slug: string) => `product:${slug}`,
  categories: 'categories',
  category: (slug: string) => `category:${slug}`,
  brands: 'brands',
  brand: (slug: string) => `brand:${slug}`,
  media: 'media',
  /** Order history feeds the "best sellers" rail. */
  orders: 'orders',
  /** Matches `getCachedGlobal` in `utilities/getGlobals.ts`. */
  global: (slug: string) => `global_${slug}`,
} as const
