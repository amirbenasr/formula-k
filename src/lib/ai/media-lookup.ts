import type { Payload } from 'payload'

import type { User } from '@/payload-types'

import type { LooseDoc } from './types'

/**
 * Searching the media library for an image the store already owns.
 *
 * This exists so the assistant reaches for the web only after it has checked
 * what is already uploaded. Reusing a library image is faster, costs nothing,
 * cannot break a licence, and is almost always the right picture: the packshots
 * already on the store are the brand's own.
 *
 * Matching is deliberately fuzzy. The admin's alt text reads "Anua Heartleaf 77%
 * Soothing Toner 250ml", the product is titled "Tonique Heartleaf 77%", and a
 * query phrased as "the anua toner" has to find it. Postgres `contains` alone
 * cannot do that, so the query is a cheap recency-bounded fetch plus scoring in
 * JS — small, testable, and no extension required.
 */

/** Words that carry no discriminating power in a product name. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'avec',
  'de',
  'des',
  'du',
  'en',
  'et',
  'for',
  'la',
  'le',
  'les',
  'of',
  'the',
  'with',
])

/** How many recent media rows a lookup inspects. */
export const MEDIA_SCAN_LIMIT = 200

/** A score at or above this is usually the same product. */
export const STRONG_MATCH = 0.6

const normalize = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const tokenize = (input: string): string[] =>
  normalize(input)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))

/** `anua-heartleaf-01.jpg` → `anua heartleaf 01`. */
const filenameToWords = (filename: string | undefined): string =>
  typeof filename === 'string'
    ? filename
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim()
    : ''

/** Escapes a string for literal use inside a RegExp. */
const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whole-word containment.
 *
 * Word boundaries matter: a bare `includes` would let the query "ton" match
 * inside "tonique", which would make short queries look like universal matches
 * and send the assistant off to attach the wrong product's photo. The length
 * floor drops the same class of noise for even shorter fragments.
 */
const containsWord = (haystack: string, needle: string): boolean => {
  if (needle.length < 4) return false

  return new RegExp(`\\b${escapeRegExp(needle)}\\b`).test(haystack)
}

/**
 * Similarity of a query to one media row, in `0..1`.
 *
 * 1    exact alt-text match
 * 0.95 exact filename match
 * 0.9  the query appears verbatim, as whole words, inside the alt text or filename
 * else token coverage, with prefix matches counted at 0.8 of a hit
 *
 * Pure and exported so the ranking can be tested without a database.
 */
export function scoreMediaMatch(
  query: string,
  candidate: { alt?: string; filename?: string },
): number {
  const wanted = normalize(query).trim()

  if (wanted.length === 0) return 0

  const alt = normalize(candidate.alt ?? '').trim()
  const filename = filenameToWords(candidate.filename)
  const haystack = `${alt} ${filename}`.trim()

  if (haystack.length === 0) return 0

  if (alt === wanted) return 1
  if (filename === wanted) return 0.95

  const phrase = containsWord(alt, wanted) || containsWord(filename, wanted) ? 0.9 : 0

  const wantedTokens = tokenize(query)
  const haystackTokens = new Set(tokenize(haystack))

  if (wantedTokens.length === 0 || haystackTokens.size === 0) return phrase

  let hits = 0

  for (const token of wantedTokens) {
    if (haystackTokens.has(token)) {
      hits += 1
      continue
    }

    // Prefix matches catch the usual suffix noise: `tonique` / `tonique77`,
    // `mask` / `maskex`. A 4-character floor stops "the"/"an" style noise from
    // matching half the library.
    for (const candidateToken of haystackTokens) {
      const shorter = Math.min(token.length, candidateToken.length)

      if (
        shorter >= 4 &&
        (candidateToken.startsWith(token) || token.startsWith(candidateToken))
      ) {
        hits += 0.8
        break
      }
    }
  }

  const coverage = hits / wantedTokens.length

  return Math.max(phrase, Math.round(Math.min(1, coverage) * 100) / 100)
}

export type MediaMatch = {
  alt: string
  credit?: string
  filename?: string
  id: number
  score: number
  source?: string
  sourceUrl?: string
  url?: string
  /** Whether the row looks like the same product. */
  strong: boolean
}

const asNumberId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null

/** Ranks the library against a query, best first. */
export async function searchMedia(
  payload: Payload,
  user: User,
  query: string,
  limit = 8,
): Promise<{ matches: MediaMatch[]; scanned: number; strongMatch: boolean }> {
  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: MEDIA_SCAN_LIMIT,
    overrideAccess: false,
    sort: '-createdAt',
    user,
    where: {},
  })

  const rows = docs as LooseDoc[]
  const matches: MediaMatch[] = []

  for (const doc of rows) {
    const id = asNumberId(doc.id)
    if (id === null) continue

    const alt = typeof doc.alt === 'string' ? doc.alt : ''
    const filename = typeof doc.filename === 'string' ? doc.filename : undefined
    const score = scoreMediaMatch(query, { alt, filename })

    matches.push({
      alt,
      credit: typeof doc.credit === 'string' ? doc.credit : undefined,
      filename,
      id,
      score,
      source: typeof doc.source === 'string' ? doc.source : undefined,
      sourceUrl: typeof doc.sourceUrl === 'string' ? doc.sourceUrl : undefined,
      strong: score >= STRONG_MATCH,
      url: typeof doc.url === 'string' ? doc.url : undefined,
    })
  }

  matches.sort((left, right) => right.score - left.score)

  // A score of 0 means no word in common at all. Returning those would be noise
  // that invites the model to attach a photo of an unrelated product, so an
  // empty list is the honest answer — it pushes the decision to tier 3.
  const relevant = matches.filter((match) => match.score > 0)

  return {
    matches: relevant.slice(0, limit),
    scanned: rows.length,
    strongMatch: relevant.length > 0 && relevant[0].score >= STRONG_MATCH,
  }
}

/** Looks up one media row, for validating an id the model supplied. */
export async function findMediaById(
  payload: Payload,
  user: User,
  id: number,
): Promise<LooseDoc | null> {
  try {
    const doc = await payload.findByID({
      collection: 'media',
      depth: 0,
      id,
      overrideAccess: false,
      user,
    })

    return (doc as LooseDoc) ?? null
  } catch {
    return null
  }
}
