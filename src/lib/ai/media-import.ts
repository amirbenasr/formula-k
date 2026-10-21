import type { Payload } from 'payload'
import sharp from 'sharp'

import type { User } from '@/payload-types'

import type { LooseDoc, ResolvedImage } from './types'

/**
 * Pulling one image off the web and into the media library.
 *
 * The storage plugin decides where the bytes land: with valid `R2_*` credentials
 * `payload.create` writes to the bucket, otherwise to `public/media`. So this file
 * says nothing about S3 — "download it to R2" is the plugin's job, and doing it
 * through the Local API means the file gets a real media row, honouring the
 * collection's access control and the plugin's upload handler.
 *
 * Everything here is defensive, because the input is a URL chosen by a language
 * model from a search result. A model-influenced URL means model-influenced
 * server-side requests, i.e. SSRF is the first thing to close: no loopback, no
 * private ranges, no link-local metadata endpoints, no non-HTTP schemes.
 */

/** Refuse anything larger than this. Product photos are well under it. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** Smaller than this is a tracking pixel or a truncated response, not a photo. */
export const MIN_IMAGE_BYTES = 1024

const DOWNLOAD_TIMEOUT_MS = 15_000

const ALLOWED_MIME = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export class ImageImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageImportError'
  }
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fd[0-9a-f]{2}:/i,
  /^\[?fe80:/i,
  /metadata\.google\.internal$/i,
]

/** Rejects anything that is not a public HTTP(S) URL. */
export function assertFetchableUrl(raw: string): URL {
  let url: URL

  try {
    url = new URL(raw)
  } catch {
    throw new ImageImportError(`"${raw}" is not a valid URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImageImportError(`Refusing to fetch a ${url.protocol} URL — only http(s) is allowed.`)
  }

  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new ImageImportError(
      `Refusing to fetch ${url.hostname}: private and loopback addresses are not allowed.`,
    )
  }

  return url
}

/** `image/jpeg; charset=binary` → `image/jpeg`. */
const baseMime = (header: string | null): string =>
  (header ?? '').split(';')[0].trim().toLowerCase()

const extensionFor = (mime: string): string => {
  switch (mime) {
    case 'image/avif':
      return 'avif'
    case 'image/gif':
      return 'gif'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'jpg'
  }
}

const filenameStem = (alt: string): string => {
  const stem = alt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return stem.length > 0 ? stem : 'product-image'
}

export type ImportImageArgs = {
  /** Alt text; also the filename stem and what `find_media` matches on later. */
  alt: string
  credit?: string
  payload: Payload
  /** The page the image came from, for attribution. */
  sourcePageUrl?: string
  url: string
  user: User
}

/**
 * Downloads, validates and stores one image.
 *
 * Returns the media row shaped for the approval preview. Throws
 * `ImageImportError` with an admin-readable sentence — the staging layer turns
 * that into a `problems[]` entry the model can react to.
 */
export async function importImageFromUrl({
  alt,
  credit,
  payload,
  sourcePageUrl,
  url,
  user,
}: ImportImageArgs): Promise<ResolvedImage> {
  const target = assertFetchableUrl(url)
  const cleanAlt = alt.trim().slice(0, 200)

  if (cleanAlt.length === 0) {
    throw new ImageImportError('An image needs alt text; none was supplied.')
  }

  let response: Response

  try {
    response = await fetch(target, {
      headers: { accept: 'image/*', 'user-agent': 'formula-k-admin-assistant/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })
  } catch (error) {
    throw new ImageImportError(
      `Could not download the image: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!response.ok) {
    throw new ImageImportError(`The image URL returned HTTP ${response.status}.`)
  }

  // Re-check after redirects: a public URL is allowed to redirect to loopback.
  assertFetchableUrl(response.url || target.toString())

  const mime = baseMime(response.headers.get('content-type'))

  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageImportError(
      `That URL returned "${mime || 'no content type'}", not a supported image (${[...ALLOWED_MIME].join(', ')}).`,
    )
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0')

  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new ImageImportError(
      `The image is ${(declaredLength / 1024 / 1024).toFixed(1)} MB, over the ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.length < MIN_IMAGE_BYTES) {
    throw new ImageImportError(
      `The downloaded file is only ${buffer.length} bytes — that is a broken or placeholder image, not a photo.`,
    )
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageImportError(
      `The image is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, over the ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`,
    )
  }

  // A server can answer 200 with HTML or a truncated file. Decoding proves the
  // bytes really are an image before they reach storage, where a bad file would
  // surface as a broken <img> on the storefront instead.
  try {
    await sharp(buffer).metadata()
  } catch {
    throw new ImageImportError('The downloaded file could not be decoded as an image.')
  }

  const filename = `${filenameStem(cleanAlt)}-${Date.now()}.${extensionFor(mime)}`

  try {
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: cleanAlt,
        ...(credit ? { credit } : {}),
        source: 'web',
        sourceUrl: sourcePageUrl ?? target.toString(),
      },
      depth: 0,
      file: {
        data: buffer,
        mimetype: mime,
        name: filename,
        size: buffer.length,
      },
      overrideAccess: false,
      user,
    })

    const doc = created as LooseDoc

    return {
      alt: cleanAlt,
      credit,
      id: doc.id as number,
      source: 'web',
      sourceUrl: (doc.sourceUrl as string) ?? sourcePageUrl ?? target.toString(),
      url: typeof doc.url === 'string' ? doc.url : undefined,
    }
  } catch (error) {
    throw new ImageImportError(
      `The image downloaded but could not be saved to the media library: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
