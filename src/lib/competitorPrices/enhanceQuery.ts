import { getCheapModel, hasDeepSeekApiKey, thinkingProviderOptions } from '@/lib/ai/provider'
import { generateText } from 'ai'
import { SEARCH_PREFIX, toSearchTerms } from './query'

/**
 * Rewrites a product title into Google keywords, one cheap model call, before
 * SerpAPI is asked anything.
 *
 * WHY THIS EXISTS
 *
 * The deterministic query in `query.ts` is the product title with its
 * punctuation flattened, which is faithful but not what a shopper types. A
 * title like "Anua – Niacinamide Dark Spot Correcting Serum – 30ml" spends
 * Google's keyword budget on marketing words ("Correcting", "Dark Spot") that
 * no shop's listing repeats verbatim, while the words that actually identify
 * the product — the brand, the actives, the size — are diluted among them.
 * Rearranging and trimming that list, and adding the French vocabulary Tunisian
 * shops publish in ("prix", "serum", "visage"), is exactly the kind of
 * mechanical rewrite a small model does well and cheaply.
 *
 * WHY IT CANNOT BREAK A LOOKUP
 *
 * This module is an optional improvement on top of a query that already works,
 * so every failure mode ends in `null` and the caller keeps the deterministic
 * query:
 *
 *  - no `DEEPSEEK_API_KEY` (the assistant is optional, and so is this),
 *  - `COMPETITOR_QUERY_ENHANCE=false`,
 *  - the model times out, errors, or returns something unusable.
 *
 * WHAT THE MODEL MAY NOT DO
 *
 * The rewrite is keyword text and nothing else. `site:` is stripped out of the
 * answer, because the filter has to keep mirroring `isCompetitorDomain` (see the
 * note in `query.ts`) and the model has no way to know that rule. Quoting is
 * stripped too, since a quoted phrase has to appear verbatim and that is the
 * mistake that made the first version of the query useless.
 *
 * The result must also still look like our product: it has to repeat at least
 * two of the title's own distinctive words (one, if the title only has one). A
 * model that drifts into a different serum, or answers with generic filler, is
 * rejected and the plain query is used.
 */

/** A slow rewrite is worse than no rewrite; the plain query is always available. */
const TIMEOUT_MS = 8_000

/** The answer is a handful of keywords; this only bounds a runaway response. */
const MAX_OUTPUT_TOKENS = 80

const MAX_QUERY_LENGTH = 160

/** `prix` plus more than a dozen keywords is noise, not a search. */
const MAX_KEYWORDS = 12

/** Words shorter than this say nothing about which product this is. */
const MIN_ANCHOR_LENGTH = 4

/** Rewriting is on by default; the deterministic query is the fallback, not a mode. */
export const isQueryEnhancementEnabled = (): boolean =>
  process.env.COMPETITOR_QUERY_ENHANCE !== 'false'

/**
 * Short on purpose: a small model given a paragraph of rules starts explaining
 * itself, and every extra token here is paid on each lookup.
 */
const SYSTEM_PROMPT = `You turn a product name into keywords for a Google search by a Tunisian price-comparison tool.

Rules:
- Keep the brand and the words that identify the product (model name, actives, volume).
- Drop marketing filler and words a shop listing would not repeat.
- Add the French words Tunisian shops use for this kind of product (prix, DT, acheter, or a French name for the product type).
- 4 to 10 keywords, one line, plain words only.
- No quotes, no site:, no OR/AND, no punctuation, no explanation.

Answer with the keywords only.`

/**
 * Returns Google keywords for this product, or `null` to mean "use the query
 * `query.ts` already builds".
 */
export async function enhanceSearchQuery({
  brand,
  title,
}: {
  brand?: null | string
  title: string
}): Promise<null | string> {
  if (!isQueryEnhancementEnabled() || !hasDeepSeekApiKey()) return null

  const product = [title, brand?.trim()].filter(Boolean).join(' ')

  try {
    const { text } = await generateText({
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // One retry at most: a retried rewrite costs more than the plain query.
      maxRetries: 1,
      model: getCheapModel(),
      prompt: `Product name: ${product}`,
      // Thinking would cost reasoning tokens and add latency to a step whose
      // whole job is to be cheap.
      providerOptions: thinkingProviderOptions('disabled'),
      system: SYSTEM_PROMPT,
      temperature: 0,
    })

    return usableQuery(text, title)
  } catch (error) {
    console.warn(
      '[competitor-prices] query enhancement failed, searching the plain query:',
      error instanceof Error ? error.message : error,
    )

    return null
  }
}

/**
 * The gate between a model's answer and SerpAPI: flattens it to a single line of
 * keywords, then checks it is still about this product.
 */
export const usableQuery = (raw: string, title: string): null | string => {
  const query = sanitize(raw)

  if (!query || query.length > MAX_QUERY_LENGTH) return null

  const words = query.split(' ')

  if (words.length > MAX_KEYWORDS || words.length < 2) return null

  return overlapsProduct(query, title) ? query : null
}

/**
 * A model answers in prose sometimes — a fenced block, a "Here is the query:"
 * preamble, a stray `site:` of its own. Keep the first non-empty line and delete
 * everything that would change how Google reads the query.
 */
const sanitize = (raw: string): string => {
  const line =
    raw
      .split('\n')
      .map((candidate) => candidate.replace(/```[a-z]*/gi, '').trim())
      .find((candidate) => candidate.length > 0) ?? ''

  return line
    // `site:.tn` and `site: .tn` are both dropped: the caller's filter is the
    // only one allowed to decide which shops count.
    .replace(/site\s*:\s*\S*/gi, ' ')
    .replace(/["'`\u2018\u2019\u201c\u201d]/g, ' ')
    // The prefix is added by `buildSearchQuery`, so a model that also offers it
    // would otherwise produce "prix prix ...".
    .replace(new RegExp(`^${SEARCH_PREFIX}\\s+`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when the rewrite still carries the title's own distinctive words.
 *
 * Two of them, when the title has two to give: "serum visage tunisie" is a query
 * about skincare in general and would fill the result set with the wrong
 * products, while "anua serum 30ml" is ours.
 */
const overlapsProduct = (query: string, title: string): boolean => {
  const anchors = new Set(
    toSearchTerms(title)
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length >= MIN_ANCHOR_LENGTH),
  )

  if (anchors.size === 0) return true

  const words = new Set(toSearchTerms(query).toLowerCase().split(' '))
  const required = anchors.size >= 2 ? 2 : 1
  let found = 0

  for (const anchor of anchors) {
    if (words.has(anchor)) found += 1
    if (found >= required) return true
  }

  return false
}
