import { CompetitorSearchError } from './errors'

/**
 * The Google search provider.
 *
 * Deliberately thin: this file knows how to call SerpAPI and nothing about
 * products or prices, so swapping in a different provider (a scraper, another
 * search API) means writing one more module with the same `googleSearch`
 * signature and leaving `search.ts` and the whole UI untouched.
 */

export type SerpApiOrganicResult = {
  link?: string
  rich_snippet?: unknown
  snippet?: string
  title?: string
}

export type SerpApiResponse = {
  error?: string
  organic_results?: SerpApiOrganicResult[]
}

const ENDPOINT = 'https://serpapi.com/search.json'

/** A hung provider must not hold an admin's request open. */
const TIMEOUT_MS = 20_000

/** How many organic results to ask for. */
const RESULT_COUNT = 20

export const getSerpApiKey = (): string | null => process.env.SERPAPI_API_KEY?.trim() || null

export async function googleSearch({
  apiKey,
  query,
}: {
  apiKey: string
  query: string
}): Promise<SerpApiResponse> {
  const url = new URL(ENDPOINT)

  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  // Ask Google for Tunisia, in French — how Tunisian shops publish their prices.
  url.searchParams.set('gl', 'tn')
  url.searchParams.set('hl', 'fr')
  url.searchParams.set('num', String(RESULT_COUNT))

  let response: Response

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    throw new CompetitorSearchError(
      `Could not reach the price search provider (${error instanceof Error ? error.message : 'unknown error'}).`,
    )
  }

  if (!response.ok) {
    const detail = await providerError(response)

    throw new CompetitorSearchError(
      `The price search provider returned ${response.status}${detail ? `: ${detail}` : ''}.`,
      response.status === 401 ? 503 : 502,
    )
  }

  const body = (await response.json()) as SerpApiResponse

  // SerpAPI answers 200 with an `error` string for bad keys and exhausted quota.
  if (typeof body.error === 'string' && body.error) {
    throw new CompetitorSearchError(`The price search provider rejected the request: ${body.error}`)
  }

  return body
}

/** SerpAPI explains 4xx responses in the body; that text is worth surfacing. */
const providerError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: unknown }

    if (typeof body.error === 'string') return body.error
  } catch {
    // Not JSON (a proxy error page, say). The status code is all we have.
  }

  return ''
}
