import { CompetitorSearchError } from './errors'
import { domainOf, parsePriceToTND, titleMatchScore } from './parse'
import { getSerpApiKey, googleSearch, type SerpApiOrganicResult } from './serpapi'

/**
 * Turns a product into a list of what competitors charge for it.
 *
 * The shape of the problem: Google returns a page of results, most of which are
 * the wrong product, the wrong country or a page with no price on it. This
 * module's whole job is to throw those away, and it would rather return nothing
 * than a wrong number — a competitor price an admin cannot trust is worse than
 * an empty table, because it silently becomes the number they price against.
 *
 * Three filters, in order: the result must be a Tunisian shop, its listing must
 * look like our product, and a dinar price must be readable from the snippet.
 */

export type MatchConfidence = 'exact' | 'likely' | 'uncertain'

export type CompetitorOffer = {
  confidence: MatchConfidence
  price: number
  /** The matched price text, e.g. `52,500`, kept for audit. */
  rawPriceText: string
  /** Competitor domain, e.g. `mytek.tn`. */
  source: string
  title: string
  url: string
}

export type CompetitorSearchResult = {
  offers: CompetitorOffer[]
  /** Organic results Google returned, before any filtering. */
  scanned: number
}

/**
 * Tunisian shops used when `COMPETITOR_DOMAINS` is not set. Mostly marketplaces
 * and electronics chains, because those are the local retailers that rank in
 * Google with a price in the snippet — the general-beauty shops are discovered
 * by the "any `.tn` host" rule below.
 */
export const DEFAULT_COMPETITOR_DOMAINS = [
  'jumia.com.tn',
  'mytek.tn',
  'tunisianet.com.tn',
  'wiki.tn',
]

/** Only the single best offer per competitor domain is kept. */
const MAX_OFFERS = 8

/** Below this, the listing is probably a different product. */
const MIN_MATCH_SCORE = 0.25

const EXACT_SCORE = 0.6
const LIKELY_SCORE = 0.4

/** The domains to accept, from `COMPETITOR_DOMAINS` or the default list. */
export function competitorDomains(): string[] {
  const configured = process.env.COMPETITOR_DOMAINS?.trim()

  if (!configured) return DEFAULT_COMPETITOR_DOMAINS

  return configured
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean)
}

/**
 * True for a shop the admin is willing to be compared against.
 *
 * Any `.tn` host counts by default, so the feature works on day one for the
 * Tunisian beauty shops nobody thought to list. Set
 * `COMPETITOR_DOMAINS_STRICT=true` to accept only `COMPETITOR_DOMAINS`.
 */
export function isCompetitorDomain(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (competitorDomains().some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return true
  }

  return process.env.COMPETITOR_DOMAINS_STRICT !== 'true' && host.endsWith('.tn')
}

/**
 * Searches Google for the product and returns one offer per Tunisian shop that
 * both looks like a match and states a price.
 */
export async function searchCompetitorPrices({
  brand,
  referencePrice,
  title,
}: {
  brand?: null | string
  /** Our own price, used only to settle ambiguous price strings. */
  referencePrice?: number
  title: string
}): Promise<CompetitorSearchResult> {
  const apiKey = getSerpApiKey()

  if (!apiKey) {
    throw new CompetitorSearchError(
      'SERPAPI_API_KEY is not set, so competitor prices cannot be looked up. Add it to .env (https://serpapi.com/manage-api-key) and restart the server.',
      503,
    )
  }

  const productTitle = title.trim()

  if (!productTitle) {
    throw new CompetitorSearchError('This product has no title to search for.', 400)
  }

  // The quoted title keeps Google on the exact product; `prix` nudges the
  // snippets towards shop listings, which are the ones that state a price.
  const query = [`"${productTitle}"`, brand?.trim(), 'prix'].filter(Boolean).join(' ')

  const response = await googleSearch({ apiKey, query })
  const results = response.organic_results ?? []
  const best = new Map<string, CompetitorOffer>()

  for (const result of results) {
    const url = typeof result.link === 'string' ? result.link : null
    const source = url ? domainOf(url) : null
    const resultTitle = typeof result.title === 'string' ? result.title : ''

    if (!url || !source || !isCompetitorDomain(source)) continue

    const score = titleMatchScore(productTitle, resultTitle)

    if (score < MIN_MATCH_SCORE) continue

    const text = [resultTitle, result.snippet, richSnippetText(result)]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' | ')

    const parsed = parsePriceToTND(text, referencePrice)

    if (!parsed) continue

    const offer: CompetitorOffer = {
      confidence: confidenceFor(score),
      price: parsed.amount,
      rawPriceText: parsed.raw,
      source,
      title: resultTitle,
      url,
    }

    const existing = best.get(source)

    if (!existing || rank(offer) < rank(existing)) best.set(source, offer)
  }

  const offers = [...best.values()].sort((a, b) => a.price - b.price).slice(0, MAX_OFFERS)

  return { offers, scanned: results.length }
}

/**
 * Google often carries the price in a rich snippet rather than the text, e.g.
 * `{ top: { extensions: ["52 DT"] } }`. It is loosely typed, so it is stringified
 * and handed to the same parser, which still demands a dinar marker.
 */
const richSnippetText = (result: SerpApiOrganicResult): string => {
  const rich = result.rich_snippet

  if (!rich || typeof rich !== 'object') return ''

  return JSON.stringify(rich)
}

const confidenceFor = (score: number): MatchConfidence => {
  if (score >= EXACT_SCORE) return 'exact'
  if (score >= LIKELY_SCORE) return 'likely'

  return 'uncertain'
}

/** Lower is better: a closer title match first, then the cheaper listing. */
const rank = (offer: CompetitorOffer): number =>
  ({ exact: 0, likely: 1000, uncertain: 2000 })[offer.confidence] + offer.price
