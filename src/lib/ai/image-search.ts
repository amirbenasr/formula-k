import { getSerpApiKey } from '@/lib/competitorPrices/serpapi'

/**
 * Web image search for the admin assistant.
 *
 * One provider: **SerpAPI's Google Images engine**, using the same
 * `SERPAPI_API_KEY` the competitor-price lookup already depends on — so this adds
 * no new vendor, no new key and no new account.
 *
 * ## Why not a Creative Commons corpus
 *
 * The first version of this used Openverse and Wikimedia Commons. That was wrong,
 * and it was removed for a concrete reason: those corpora do not contain branded
 * beauty or household products at all. A search for a toner returned a 1918
 * painting of filtered blood serum and a pig-cholera plant. There is no query
 * tuning that fixes a corpus with the wrong contents.
 *
 * Google Images returns the brand's own packshots and retailer listings, which is
 * the only thing that helps a store that resells those exact products.
 *
 * ## The licence reality, stated plainly
 *
 * These are other people's copyrighted photos, not licensed stock. So:
 *  - every media row records its provenance (`source` domain, page URL);
 *  - a human approves the image in the proposal before it reaches a product;
 *  - the assistant is told to name the source and never call it a licensed asset.
 *
 * SerpAPI can filter to freely licensed images (`licenses=fc`), but that throws
 * away the brand packshots and leaves stock photography — i.e. it defeats the
 * purpose. Provenance plus human review is the trade made here.
 *
 * ## What is returned, and what is not
 *
 * Search returns metadata and URLs only. Nothing is downloaded here; bytes are
 * fetched later, at staging time, so a human sees the actual picture before a
 * product changes. That split is why a failed download can never corrupt a
 * product silently.
 */

export type WebImageCandidate = {
  /**
   * Where the image came from — the result's `source` label (e.g. "Anua",
   * "YesStyle"), falling back to the hostname. Stored as the media row's credit.
   */
  credit?: string
  height?: number
  /** Google's own "this looks like a product photo" flag. */
  isProduct?: boolean
  /** The page the image sits on: attribution, and the download's `Referer`. */
  pageUrl?: string
  provider: 'serpapi'
  /**
   * SerpAPI's own copy of the thumbnail. Tried only if the source CDN refuses
   * the direct download (hotlink protection), because it is always fetchable.
   */
  fallbackUrl?: string
  title: string
  /** Direct image URL on the source CDN. This is what we try first. */
  url: string
  width?: number
}

export type WebImageSearch = {
  candidates: WebImageCandidate[]
  /** Why the search came back empty, or a caveat worth passing to the admin. */
  note?: string
  provider: string
}

const ENDPOINT = 'https://serpapi.com/search.json'

/** Google can be slow to render an image page; the competitor lookup uses 20s too. */
const TIMEOUT_MS = 20_000

/**
 * Rejects results whose "original" is really a thumbnail.
 *
 * `imgsz=2mp` asks Google for large images, but the parameter is a hint, not a
 * guarantee — a 150px GIF would look fine in a picker and terrible as a product's
 * primary image. Undefined dimensions are kept: better to try the download than
 * to discard an otherwise valid URL on missing metadata.
 */
export const MIN_IMAGE_DIMENSION = 300

const decodeHtml = (input: string): string =>
  input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()

/**
 * Tags are replaced with a space, not deleted, so `<b>Toner</b> Cream` does not
 * become `TonerCream`. The whitespace collapse then keeps that space from
 * doubling up in the alt text and the generated filename.
 */
const stripHtml = (input: string): string =>
  decodeHtml(input.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

const httpUrl = (value: unknown): null | string =>
  typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null

const asDimension = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined

/** `https://www.anua.com/x.jpg` → `anua.com`. Used when `source` is missing. */
const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/**
 * Pure: SerpAPI's `{ images_results: [...] }` shape into candidates.
 *
 * Exported so the mapping — including the traps (missing `original`, thumbnail
 * sized originals, HTML entities in titles) — can be tested without the network.
 */
export function parseSerpApiImages(payload: unknown): WebImageCandidate[] {
  const results = (payload as { images_results?: unknown } | null)?.images_results

  if (!Array.isArray(results)) return []

  const candidates: WebImageCandidate[] = []

  for (const raw of results) {
    if (!raw || typeof raw !== 'object') continue

    const row = raw as Record<string, unknown>
    const url = httpUrl(row.original)

    // Without `original` there is nothing to download: the entry is only a
    // thumbnail in Google's UI and cannot become a product image.
    if (!url) continue

    const width = asDimension(row.original_width)
    const height = asDimension(row.original_height)

    if (
      (width !== undefined && width < MIN_IMAGE_DIMENSION) ||
      (height !== undefined && height < MIN_IMAGE_DIMENSION)
    ) {
      continue
    }

    const source = typeof row.source === 'string' ? stripHtml(row.source) : ''
    const title = typeof row.title === 'string' ? stripHtml(row.title) : ''

    candidates.push({
      credit: source || hostOf(url),
      height,
      isProduct: row.is_product === true,
      pageUrl: httpUrl(row.link) ?? undefined,
      provider: 'serpapi',
      fallbackUrl: httpUrl(row.thumbnail) ?? undefined,
      title: title || 'Untitled',
      url,
      width,
    })
  }

  return candidates
}

/**
 * Finds candidate images for a query.
 *
 * Never throws. A missing key, an exhausted quota or an unreachable provider all
 * come back as an empty list with a sentence the assistant can relay, so one
 * failed search cannot break the chat turn.
 */
export async function searchWebImages(query: string, limit = 8): Promise<WebImageSearch> {
  const wanted = query.trim()
  const provider = (process.env.IMAGE_SEARCH_PROVIDER || 'serpapi').toLowerCase()

  if (wanted.length === 0) {
    return { candidates: [], note: 'Empty search query.', provider }
  }

  if (provider === 'none') {
    return {
      candidates: [],
      note: 'Web image search is disabled (IMAGE_SEARCH_PROVIDER=none). Upload an image instead.',
      provider: 'none',
    }
  }

  if (provider !== 'serpapi') {
    return {
      candidates: [],
      note: `Unsupported IMAGE_SEARCH_PROVIDER "${provider}" — use "serpapi" or "none".`,
      provider,
    }
  }

  const apiKey = getSerpApiKey()

  if (!apiKey) {
    return {
      candidates: [],
      note: 'SERPAPI_API_KEY is not set, so web image search is unavailable. Upload an image instead.',
      provider,
    }
  }

  const url = new URL(ENDPOINT)

  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('engine', 'google_images')
  url.searchParams.set('q', wanted)
  // Same market as the competitor-price lookup: a Tunisian store, French UI.
  url.searchParams.set('gl', 'tn')
  url.searchParams.set('hl', 'fr')
  url.searchParams.set('ijn', '0')
  // Photos only — no clipart or line drawings — and large enough to use.
  url.searchParams.set('image_type', 'photo')
  url.searchParams.set('imgsz', '2mp')
  url.searchParams.set('safe', 'active')

  let response: Response

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    return {
      candidates: [],
      note: `Could not reach the image search provider (${error instanceof Error ? error.message : 'unknown error'}).`,
      provider,
    }
  }

  if (!response.ok) {
    return { candidates: [], note: `The image search provider returned HTTP ${response.status}.`, provider }
  }

  const body: unknown = await response.json().catch(() => null)

  // SerpAPI answers 200 with an `error` string for a bad key or exhausted quota.
  const providerError = (body as { error?: unknown } | null)?.error

  if (typeof providerError === 'string' && providerError.length > 0) {
    return { candidates: [], note: `The image search provider rejected the request: ${providerError}`, provider }
  }

  const candidates = parseSerpApiImages(body)

  if (candidates.length === 0) {
    return {
      candidates: [],
      note: `No usable images found for "${wanted}". Ask the admin to upload one instead.`,
      provider,
    }
  }

  // Google's own ordering is relevance-ranked; re-sorting it here would only
  // guess again. `isProduct` is passed through so the model can prefer a
  // packshot when it explains the options.
  return { candidates: candidates.slice(0, limit), provider }
}
