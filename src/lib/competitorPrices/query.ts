/**
 * Builds the Google query used to find competitor listings.
 *
 * The first version quoted the full product title:
 *
 *   "Anua – Niacinamide Dark Spot Correcting Serum – 30ml" Anua prix
 *
 * That is close to useless. A quoted phrase has to appear verbatim, no shop
 * writes a title with those en dashes, and Google answered with 8 results that
 * were mostly the brand's own pages. Searching by hand with
 *
 *   prix Anua Niacinamide Dark Spot Correcting Serum 30ml site:.tn
 *
 * returns 20+ Tunisian shops. So this module builds that query instead: plain
 * keywords, no quotes, the title's punctuation flattened to spaces, and a
 * `site:` filter that mirrors the same acceptance rule the caller post-filters
 * with. Query and filter have to agree — `site:` built from the *default* domain
 * list would exclude every other `.tn` shop that `isCompetitorDomain` happily
 * accepts, and the results would be thrown away for no reason.
 */

/**
 * French for "price". Tunisian shops publish in French, and the word pulls
 * snippets that actually contain a price towards the top.
 */
export const SEARCH_PREFIX = 'prix'

/** Hyphen, non-breaking hyphen, figure dash, en dash, em dash, horizontal bar, minus. */
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g

/** Combining marks left behind by NFD decomposition, e.g. `e` + U+0301. */
const COMBINING_MARKS = /[\u0300-\u036f]/g

/** Anything that is not a word character or whitespace. Applied after accents. */
const PUNCTUATION = /[^\w\s]+/g

const WHITESPACE = /\s+/g

/**
 * Flattens a product title into Google keywords.
 *
 * `Anua – Niacinamide Dark Spot Correcting Serum – 30ml` becomes
 * `Anua Niacinamide Dark Spot Correcting Serum 30ml`, and accents are dropped so
 * `Sérum Éclat` matches a shop that wrote `Serum Eclat`. Non-Latin titles flatten
 * to nothing, which the caller treats as "no usable search terms" rather than
 * searching for the site filter alone.
 */
export const toSearchTerms = (title: string): string =>
  title
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(DASHES, ' ')
    .replace(PUNCTUATION, ' ')
    .replace(WHITESPACE, ' ')
    .trim()

/**
 * The `site:` clause, mirroring `isCompetitorDomain`.
 *
 * In strict mode only the configured domains are accepted, so only those are
 * searched. Otherwise any `.tn` host counts — which Google expresses as
 * `site:.tn` — plus any explicitly configured domain outside `.tn`, which the
 * `.tn` clause alone would have excluded.
 */
export const siteFilter = ({ domains, strict }: { domains: string[]; strict: boolean }): string => {
  const parts = strict ? domains : ['.tn', ...domains.filter((domain) => !domain.endsWith('.tn'))]
  const unique = [...new Set(parts.filter(Boolean))]

  if (unique.length === 0) return ''
  if (unique.length === 1) return `site:${unique[0]}`

  return `(${unique.map((domain) => `site:${domain}`).join(' OR ')})`
}

export const buildSearchQuery = ({
  domains,
  strict,
  title,
}: {
  domains: string[]
  strict: boolean
  title: string
}): string =>
  [SEARCH_PREFIX, toSearchTerms(title), siteFilter({ domains, strict })]
    .filter(Boolean)
    .join(' ')
