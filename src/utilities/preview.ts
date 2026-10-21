import type { CollectionSlug } from 'payload'

/**
 * Collections that can be previewed, mapped to the storefront route prefix their
 * documents are rendered under. Pages live at the site root, hence the empty
 * prefix.
 */
export const previewCollectionPaths = {
  pages: '',
  products: '/products',
} satisfies Partial<Record<CollectionSlug, string>>

export type PreviewCollection = keyof typeof previewCollectionPaths

export type PreviewTarget = {
  collection: PreviewCollection
  /** Storefront path the document is rendered at. */
  path: string
  slug: string
}

export type PreviewSearchParamsResult =
  | { ok: true; preview: PreviewTarget }
  | { message: string; ok: false; status: number }

export const isPreviewCollection = (value: null | string): value is PreviewCollection =>
  value !== null && Object.hasOwn(previewCollectionPaths, value)

/** Storefront path a previewed document is rendered at. */
export const getPreviewPath = (collection: PreviewCollection, slug: string): string =>
  `${previewCollectionPaths[collection]}/${slug}`

type GeneratePreviewPathArgs = {
  collection: PreviewCollection
  slug: null | string | undefined
  /**
   * Payload passes a `req` to `admin.preview` / `admin.livePreview.url`; accepted
   * so the call sites can keep forwarding it. The route authenticates the admin
   * session itself, so nothing from the request is needed here.
   */
  req?: unknown
}

/**
 * URL of the draft-preview route for a document, or `null` when it has no slug
 * yet (an unsaved document).
 *
 * No shared secret is embedded: `/next/preview` authenticates the admin session
 * that clicked the link. See `src/app/(app)/next/preview/route.ts`.
 */
export const generatePreviewPath = ({
  collection,
  slug,
}: GeneratePreviewPathArgs): null | string => {
  if (!slug) {
    return null
  }

  const encodedParams = new URLSearchParams({
    collection,
    path: getPreviewPath(collection, slug),
    slug,
  })

  return `/next/preview?${encodedParams.toString()}`
}

/**
 * Validates the query string of a preview request.
 *
 * The redirect target is always derived from `collection` + `slug`, never taken
 * from the URL. `path` is still accepted for links generated before the route
 * stopped deriving it, but only when it agrees with the derived path — otherwise
 * a crafted link could switch draft mode on and then bounce the visitor to an
 * arbitrary location.
 */
export const parsePreviewSearchParams = (
  searchParams: Pick<URLSearchParams, 'get'>,
): PreviewSearchParamsResult => {
  const collection = searchParams.get('collection')
  const slug = searchParams.get('slug')
  const requestedPath = searchParams.get('path')

  if (!isPreviewCollection(collection)) {
    return { message: 'Unknown collection', ok: false, status: 400 }
  }

  if (!slug) {
    return { message: 'Insufficient search params', ok: false, status: 400 }
  }

  const path = getPreviewPath(collection, slug)

  if (requestedPath !== null && requestedPath !== path) {
    return {
      message: 'Preview path does not match the requested document',
      ok: false,
      status: 400,
    }
  }

  return { ok: true, preview: { collection, path, slug } }
}
