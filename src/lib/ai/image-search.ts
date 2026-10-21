/**
 * Web image search for the admin assistant.
 *
 * Scope, stated up front because it drives every decision in this file: this is
 * a **last resort**. The assistant is instructed to reuse an image the store
 * already owns before it looks at the open web, and to treat whatever it finds
 * here as "a plausible photo", never as the brand's official packshot.
 *
 * There is no image-search API key in this project, so both providers are
 * keyless and both return openly licensed media:
 *
 *  - **Openverse** (`api.openverse.org`) aggregates CC-licensed and public-domain
 *    images. Best titles for product-shaped queries.
 *  - **Wikimedia Commons** is the fallback. Its API is generous, stable and
 *    needs no key at all, but its corpus is encyclopaedic — good for "sunscreen
 *    bottle", poor for a specific serum.
 *
 * Both are queried over plain `fetch`, so nothing new has to be installed and no
 * credentials have to be provisioned for the feature to work. Any provider that
 * does need a key can be added behind `IMAGE_SEARCH_PROVIDER` later.
 */

export type WebImageCandidate = {
  /** Author + licence, ready to store on the media row. */
  credit?: string
  height?: number
  license?: string
  provider: 'commons' | 'openverse'
  /** The page the image came from, for attribution. */
  sourceUrl?: string
  /** Provider tags, used for relevance ranking and offered as alt-text hints. */
  tags?: string[]
  title: string
  /** Direct image file URL. Verified to be http(s). */
  url: string
  width?: number
}

export type WebImageSearch = {
  candidates: WebImageCandidate[]
  /** Why the search came back empty, when it did. */
  note?: string
  provider: string
  /**
   * True when the precise query found nothing and a broader one was used. The
   * results are then only topically related — never the product's own picture.
   */
  relaxed?: boolean
  /** The query that actually produced the candidates. */
  usedQuery?: string
}

const USER_AGENT =
  'formula-k-admin-assistant/1.0 (product image lookup; +https://formula-k.tn)'

/**
 * Words that only add noise to an image search.
 *
 * Image corpora are AND-matched, so a five-word product name matches almost
 * nothing — "anua heartleaf toner bottle" returns zero results on both
 * providers. Dropping the packaging nouns is what turns such a query into
 * something the corpus can answer.
 */
const FILLER = new Set([
  'avec',
  'bottle',
  'box',
  'de',
  'des',
  'du',
  'en',
  'et',
  'flacon',
  'for',
  'la',
  'le',
  'les',
  'ml',
  'new',
  'of',
  'pack',
  'the',
  'with',
])

const tokenizeQuery = (input: string): string[] =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !FILLER.has(token))

/**
 * Query variants from most to least precise.
 *
 * Never degrades to a single word: "toner" alone returns printer cartridges and
 * "bottle" returns everything bottled, and a confidently wrong photo is worse
 * than no photo. Two words is the floor.
 */
export function buildQueryVariants(query: string): string[] {
  const tokens = tokenizeQuery(query)
  const variants: string[] = []
  const add = (candidate: string) => {
    const trimmed = candidate.trim()
    if (trimmed.length > 0 && !variants.includes(trimmed)) variants.push(trimmed)
  }

  add(query)

  if (tokens.length >= 2) add(tokens.slice(-2).join(' '))
  if (tokens.length >= 3) add(tokens.slice(-3).join(' '))
  if (tokens.length >= 2) add(tokens.slice(0, 2).join(' '))

  return variants
}

const decodeHtml = (input: string): string =>
  input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()

/** Commons metadata is HTML; the media row needs a sentence. */
const stripHtml = (input: string): string => decodeHtml(input.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ')

const creditLine = (creator?: string, license?: string): string | undefined => {
  const parts = [creator, license].filter((part): part is string => Boolean(part && part.trim()))
  return parts.length > 0 ? parts.join(' · ') : undefined
}

const asDimension = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined

const httpUrl = (value: unknown): string | null =>
  typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null

/** Pure: Openverse's `{ results: [...] }` shape into candidates. */
export function parseOpenverseResults(payload: unknown): WebImageCandidate[] {
  const results = (payload as { results?: unknown } | null)?.results

  if (!Array.isArray(results)) return []

  const candidates: WebImageCandidate[] = []

  for (const raw of results) {
    if (!raw || typeof raw !== 'object') continue

    const row = raw as Record<string, unknown>
    const url = httpUrl(row.url)

    if (!url) continue

    const creator = typeof row.creator === 'string' ? decodeHtml(row.creator) : undefined
    const license = [row.license, row.license_version]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')

    const title = typeof row.title === 'string' && row.title.trim() ? decodeHtml(row.title) : 'Untitled'

    const tags = Array.isArray(row.tags)
      ? row.tags
          .map((tag) => {
            const name = (tag as { name?: unknown } | null)?.name
            return typeof name === 'string' ? name.trim() : ''
          })
          .filter((name) => name.length > 0)
      : []

    candidates.push({
      credit: creditLine(creator, license || undefined),
      height: asDimension(row.height),
      license: license || undefined,
      provider: 'openverse',
      sourceUrl: httpUrl(row.foreign_landing_url) ?? undefined,
      ...(tags.length > 0 ? { tags } : {}),
      title,
      url,
      width: asDimension(row.width),
    })
  }

  return candidates
}

/** Pure: MediaWiki's `query.pages` shape into candidates. */
export function parseCommonsResponse(payload: unknown): WebImageCandidate[] {
  const pages = (payload as { query?: { pages?: unknown } } | null)?.query?.pages

  if (!pages || typeof pages !== 'object') return []

  const candidates: WebImageCandidate[] = []

  for (const raw of Object.values(pages as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue

    const page = raw as Record<string, unknown>
    const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null

    if (!info || typeof info !== 'object') continue

    const meta = info as Record<string, unknown>
    // `thumburl` is the pre-scaled rendition; the original can be 50 MB.
    const url = httpUrl(meta.thumburl) ?? httpUrl(meta.url)

    if (!url) continue

    const ext = (meta.extmetadata ?? {}) as Record<string, { value?: unknown } | undefined>
    const license = typeof ext.LicenseShortName?.value === 'string' ? stripHtml(ext.LicenseShortName.value) : ''
    const artist = typeof ext.Artist?.value === 'string' ? stripHtml(ext.Artist.value) : ''

    const title =
      typeof page.title === 'string'
        ? stripHtml(page.title).replace(/^File:/i, '')
        : 'Untitled'

    candidates.push({
      credit: creditLine(artist || undefined, license || undefined),
      height: asDimension(meta.thumbheight) ?? asDimension(meta.height),
      license: license || undefined,
      provider: 'commons',
      sourceUrl: httpUrl(meta.descriptionurl) ?? undefined,
      title: title || 'Untitled',
      url,
      width: asDimension(meta.thumbwidth) ?? asDimension(meta.width),
    })
  }

  return candidates
}

/**
 * Re-orders candidates by how much of the query their title and tags cover.
 *
 * The providers rank by their own popularity signals, which is how a search for
 * "toner" surfaces printer cartridges above skincare. Overlap with the requested
 * words is a crude signal, but it is the right kind of crude: it prefers the
 * photo whose caption actually mentions what was asked for.
 */
export function rankImageCandidates(
  candidates: WebImageCandidate[],
  query: string,
): WebImageCandidate[] {
  const wanted = new Set(tokenizeQuery(query))

  if (wanted.size === 0) return candidates

  const score = (candidate: WebImageCandidate): number => {
    const words = new Set(tokenizeQuery(`${candidate.title} ${(candidate.tags ?? []).join(' ')}`))
    let hits = 0

    for (const token of wanted) {
      if (words.has(token)) hits += 1
    }

    return hits / wanted.size
  }

  // `sort` is stable, so equally relevant results keep the provider's order.
  return candidates
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate)
}

/** A failure is data here, not an exception: the model reports it to the admin. */
async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...headers },
    // Long enough for a slow CDN, short enough that the chat does not stall.
    signal: AbortSignal.timeout(6000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

async function searchOpenverse(query: string, limit: number): Promise<WebImageCandidate[]> {
  const params = new URLSearchParams({
    // CC images only: the storefront publishes them, so all-rights-reserved
    // results would be a liability rather than a shortcut.
    license_type: 'all-cc',
    mature: 'false',
    page_size: String(limit),
    q: query,
  })

  const token = process.env.OPENVERSE_TOKEN

  // A token raises Openverse's rate limit; anonymous access works without one.
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`

  const payload = await fetchJson(`https://api.openverse.org/v1/images/?${params}`, headers)

  return parseOpenverseResults(payload).slice(0, limit)
}

async function searchCommons(query: string, limit: number): Promise<WebImageCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrlimit: String(limit),
    gsrnamespace: '6',
    // Bitmaps only — an SVG would be rejected by the image validator downstream.
    gsrsearch: `${query} filetype:bitmap`,
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '1200',
    prop: 'imageinfo',
  })

  const payload = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`)

  return parseCommonsResponse(payload).slice(0, limit)
}

/**
 * How many provider requests one search may make.
 *
 * Variants multiply by providers, and every extra request is latency in the chat.
 * Four covers the precise query on both providers plus one relaxed retry, which
 * is where the useful results are; beyond that it is just spending the admin's
 * time to confirm there is nothing better.
 */
const MAX_ATTEMPTS = 4

/**
 * Finds candidate images for a query, relaxing it only if it finds nothing.
 *
 * Never throws: an unreachable provider comes back as an empty list with a note,
 * so the assistant can tell the admin "the image search is unavailable" instead
 * of the whole chat turn failing.
 */
export async function searchWebImages(query: string, limit = 6): Promise<WebImageSearch> {
  const provider = (process.env.IMAGE_SEARCH_PROVIDER || 'auto').toLowerCase()
  const wanted = query.trim()

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

  const providers: Array<{
    name: 'commons' | 'openverse'
    run: (search: string, take: number) => Promise<WebImageCandidate[]>
  }> = []

  if (provider === 'auto' || provider === 'openverse') {
    providers.push({ name: 'openverse', run: searchOpenverse })
  }

  if (provider === 'auto' || provider === 'commons') {
    providers.push({ name: 'commons', run: searchCommons })
  }

  if (providers.length === 0) {
    return { candidates: [], note: `Unknown provider "${provider}".`, provider }
  }

  const problems: string[] = []
  let attempts = 0

  // Ask for more than needed, so re-ranking has something to choose from.
  const take = Math.min(Math.max(limit * 3, limit), 24)

  for (const variant of buildQueryVariants(wanted)) {
    for (const candidateProvider of providers) {
      if (attempts >= MAX_ATTEMPTS) break
      attempts += 1

      try {
        const found = await candidateProvider.run(variant, take)

        if (found.length === 0) {
          problems.push(`${candidateProvider.name} found nothing for "${variant}"`)
          continue
        }

        const relaxed = variant !== wanted

        return {
          candidates: rankImageCandidates(found, wanted).slice(0, limit),
          provider: candidateProvider.name,
          ...(relaxed
            ? {
                note: `Nothing matched "${wanted}", so these were found for "${variant}". They are topically related, not pictures of this product.`,
                relaxed: true,
              }
            : {}),
          usedQuery: variant,
        }
      } catch (error) {
        problems.push(
          `${candidateProvider.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    if (attempts >= MAX_ATTEMPTS) break
  }

  return {
    candidates: [],
    note: `No images found. ${problems.join('; ')}`.trim(),
    provider,
  }
}
