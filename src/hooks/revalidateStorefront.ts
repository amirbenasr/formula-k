import type { Brand, Category, Product } from '@/payload-types'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  Payload,
  TypeWithID,
} from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

import { CACHE_TAGS } from '@/utilities/cacheTags'

/**
 * Runs a revalidation callback without ever breaking the write that triggered it.
 *
 * Payload hooks also run outside a Next.js request (CLI scripts, seeds, the
 * migration runner). In those contexts `revalidatePath`/`revalidateTag` throw
 * because there is no static generation store, so a cache miss must never turn
 * a successful save into a 500.
 */
function safeRevalidate(payload: Payload, label: string, run: () => void) {
  try {
    run()
  } catch (error) {
    payload.logger.warn({ err: error, label }, 'Storefront cache revalidation skipped')
  }
}

type SluggedDocument = { slug?: null | string }

type SlugRevalidateConfig = {
  /** Human-readable name used in logs. */
  label: string
  /** Tags invalidated on every write (list-level caches). */
  listTags: string[]
  /** Tag for a single document, keyed by slug. */
  slugTag?: (slug: string) => string
  /** Public path for a single document, keyed by slug. */
  slugPath?: (slug: string) => string
  /** Static paths that embed this collection. */
  paths?: string[]
}

/**
 * Builds the afterChange/afterDelete pair that keeps a slug-addressed collection
 * in sync with the storefront cache, including the old slug when a document is
 * renamed.
 */
export function createSlugRevalidateHooks<T extends SluggedDocument & TypeWithID>({
  label,
  listTags,
  slugTag,
  slugPath,
  paths = [],
}: SlugRevalidateConfig): {
  afterChange: CollectionAfterChangeHook<T>
  afterDelete: CollectionAfterDeleteHook<T>
} {
  function revalidate(oldDoc?: null | Partial<T>, newDoc?: null | Partial<T>) {
    for (const tag of listTags) {
      revalidateTag(tag)
    }

    for (const path of paths) {
      revalidatePath(path)
    }

    for (const slug of new Set([newDoc?.slug, oldDoc?.slug])) {
      if (!slug) continue
      if (slugTag) revalidateTag(slugTag(slug))
      if (slugPath) revalidatePath(slugPath(slug))
    }
  }

  return {
    afterChange: ({ doc, previousDoc, req }) => {
      if (!req.context?.disableRevalidate) {
        safeRevalidate(req.payload, label, () => revalidate(previousDoc, doc))
      }

      return doc
    },
    afterDelete: ({ doc, req }) => {
      if (!req.context?.disableRevalidate) {
        safeRevalidate(req.payload, label, () => revalidate(doc, null))
      }

      return doc
    },
  }
}

/**
 * Revalidates a Payload global (header, footer, site settings). The tag name
 * must match `getCachedGlobal` in `utilities/getGlobals.ts`.
 */
export function createGlobalRevalidateHook(slug: string): GlobalAfterChangeHook {
  return ({ doc, req }) => {
    if (!req.context?.disableRevalidate) {
      safeRevalidate(req.payload, slug, () => {
        revalidateTag(CACHE_TAGS.global(slug))
        // Globals render in the root layout of every storefront route.
        revalidatePath('/', 'layout')
      })
    }

    return doc
  }
}

/**
 * Media has no slug: replacing a file changes product photos on every page that
 * shows the product, so invalidate the whole catalogue's caches.
 */
export const revalidateMediaAfterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  if (!req.context?.disableRevalidate) {
    safeRevalidate(req.payload, 'media', () => {
      revalidateTag(CACHE_TAGS.media)
      revalidateTag(CACHE_TAGS.products)
      revalidateTag(CACHE_TAGS.brands)
      revalidatePath('/')
    })
  }

  return doc
}

export const revalidateMediaAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (!req.context?.disableRevalidate) {
    safeRevalidate(req.payload, 'media', () => {
      revalidateTag(CACHE_TAGS.media)
      revalidateTag(CACHE_TAGS.products)
      revalidateTag(CACHE_TAGS.brands)
      revalidatePath('/')
    })
  }

  return doc
}

/**
 * Product changes affect the homepage rails, every listing page and the detail
 * page itself (including the old URL when the slug is renamed).
 */
export const productRevalidate = createSlugRevalidateHooks<Product>({
  label: 'products',
  listTags: [CACHE_TAGS.products],
  slugTag: CACHE_TAGS.product,
  slugPath: (slug) => `/products/${slug}`,
  paths: ['/', '/shop'],
})

/** Category changes affect the header nav, homepage circles and category pages. */
export const categoryRevalidate = createSlugRevalidateHooks<Category>({
  label: 'categories',
  listTags: [CACHE_TAGS.categories, CACHE_TAGS.products],
  slugTag: CACHE_TAGS.category,
  slugPath: (slug) => `/shop/${slug}`,
  paths: ['/', '/shop'],
})

/** Brand changes affect the brand directory, homepage strip and brand pages. */
export const brandRevalidate = createSlugRevalidateHooks<Brand>({
  label: 'brands',
  listTags: [CACHE_TAGS.brands, CACHE_TAGS.products],
  slugTag: CACHE_TAGS.brand,
  slugPath: (slug) => `/brands/${slug}`,
  paths: ['/', '/brands', '/shop'],
})
