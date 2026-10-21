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
 * ## Two safeguards, for two different threats
 *
 * **SSRF.** The URL is model-influenced (a search result it chose), which makes
 * server-side requests model-influenced too. Only public http(s) is allowed, and
 * the check runs *before* the request and again against the final URL after
 * redirects, because a public host is allowed to redirect to loopback.
 *
 * **Hotlink protection.** Image search returns URLs on the source's own CDN, and
 * plenty of those refuse a request that does not look like a browser on their own
 * page — a 403, or a 200 carrying an HTML error page. So a download is a ladder:
 * the source URL with a browser user-agent and a `Referer` of the page the image
 * appears on, then the search provider's own copy of the thumbnail. Whatever
 * survives is decoded with `sharp` before it reaches storage, because a CDN
 * answering 200 is not proof that the bytes are an image.
 */

/** Refuse anything larger than this. Product photos are well under it. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** Smaller than this is a tracking pixel or a truncated response, not a photo. */
export const MIN_IMAGE_BYTES = 1024

const DOWNLOAD_TIMEOUT_MS = 15_000

/**
 * A browser-shaped user-agent.
 *
 * Deliberate, and a trade: a fair number of retail CDNs reject unknown agents
 * outright, so an honest `formula-k-admin-assistant/1.0` turns those into a dead
 * end. We are fetching a public image that a human then reviews — not evading a
 * paywall.
 */
const DOWNLOAD_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

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
const baseMime = (header: null | string): string =>
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

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

type DownloadedImage = { buffer: Buffer; mime: string; resolvedUrl: string }

/** One attempt: fetch, validate, decode. Throws `ImageImportError` on any miss. */
async function downloadImage(url: string, referer?: string): Promise<DownloadedImage> {
  const target = assertFetchableUrl(url)

  let response: Response

  try {
    response = await fetch(target, {
      headers: {
        accept: 'image/*',
        'user-agent': DOWNLOAD_USER_AGENT,
        ...(referer ? { referer } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })
  } catch (error) {
    throw new ImageImportError(`Could not download the image: ${describeError(error)}`)
  }

  if (!response.ok) {
    throw new ImageImportError(`The image URL returned HTTP ${response.status}.`)
  }

  // Re-check after redirects: a public URL is allowed to redirect to loopback.
  const resolvedUrl = response.url || target.toString()
  assertFetchableUrl(resolvedUrl)

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

  return { buffer, mime, resolvedUrl }
}

export type ImportImageArgs = {
  /** Alt text; also the filename stem and what `find_media` matches on later. */
  alt: string
  credit?: string
  /**
   * Second URL to try when the source refuses the direct download — normally the
   * search provider's own copy of the thumbnail.
   */
  fallbackUrl?: string
  payload: Payload
  /**
   * Sent as `Referer`. Many retail CDNs only serve their images to a request that
   * claims to come from their own page.
   */
  referer?: string
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
  fallbackUrl,
  payload,
  referer,
  sourcePageUrl,
  url,
  user,
}: ImportImageArgs): Promise<ResolvedImage> {
  const cleanAlt = alt.trim().slice(0, 200)

  if (cleanAlt.length === 0) {
    throw new ImageImportError('An image needs alt text; none was supplied.')
  }

  const attempts = [url, ...(fallbackUrl && fallbackUrl !== url ? [fallbackUrl] : [])]
  const failures: string[] = []

  let downloaded: DownloadedImage | undefined

  for (const [index, attempt] of attempts.entries()) {
    try {
      downloaded = await downloadImage(attempt, referer)
      break
    } catch (error) {
      failures.push(`${index === 0 ? 'source image' : 'fallback image'}: ${describeError(error)}`)
    }
  }

  if (!downloaded) {
    throw new ImageImportError(`Could not fetch a usable image. ${failures.join('; ')}`)
  }

  const filename = `${filenameStem(cleanAlt)}-${Date.now()}.${extensionFor(downloaded.mime)}`

  try {
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: cleanAlt,
        ...(credit ? { credit } : {}),
        source: 'web',
        sourceUrl: sourcePageUrl ?? downloaded.resolvedUrl,
      },
      depth: 0,
      file: {
        data: downloaded.buffer,
        mimetype: downloaded.mime,
        name: filename,
        size: downloaded.buffer.length,
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
      sourceUrl: (doc.sourceUrl as string) ?? sourcePageUrl ?? downloaded.resolvedUrl,
      url: typeof doc.url === 'string' ? doc.url : undefined,
    }
  } catch (error) {
    throw new ImageImportError(
      `The image downloaded but could not be saved to the media library: ${describeError(error)}`,
    )
  }
}
