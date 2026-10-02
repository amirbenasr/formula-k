import { roundAmount } from '@/components/admin/tndPrice'

/**
 * Price extraction for competitor search results.
 *
 * Google gives us prose, not data: a competitor's price arrives as a snippet
 * like `"Prix : 52,500 DT"` or `"1 250,000 DT"`. Everything here turns that
 * prose into a dinar amount, and — just as importantly — refuses to turn
 * anything else into one.
 *
 * WHY A DINAR MARKER IS MANDATORY
 * Product names are full of numbers: "COSRX Snail 96 Mucin Power Essence
 * 100ml". A parser that grabs the first number it sees reports a competitor
 * price of 96 DT for a 100ml bottle, which is worse than reporting nothing. So
 * a number only counts as a price when a dinar marker (`DT`, `TND`, `dinars`)
 * sits within a small window of it, and no foreign currency marker does.
 *
 * WHY 3 DECIMALS IS A MILLIME, NOT A THOUSAND
 * The dinar is divided into 1000 millimes, so Tunisian shops write three
 * decimals: `52,500 DT` is 52.5 DT, not 52 500 DT. See `@/components/admin/tndPrice`,
 * which the admin panel already uses for the same rule — hence the import rather
 * than a second copy of the constant.
 */

export type ParsedPrice = {
  /** The amount in dinars, resolved as far as the text allows. */
  amount: number
  /**
   * True when the raw text read two ways and no reference price settled it.
   * Stored on the row so a surprising figure can be spotted later.
   */
  ambiguous: boolean
  /** The text that was matched, so the admin can see what the number came from. */
  raw: string
}

/**
 * `\b` matters: without it `DT` matches inside words. With it, `TND` is still
 * matched by its own alternative first because the alternation is ordered.
 */
const TND_MARKER = /(?:\bTND\b|\bDT\b|\bD\.T\b|د\.ت|\bdinars?\b)/i

/** Any of these near the number means it is not a dinar price. */
const FOREIGN_MARKER = /(?:€|\$|£|\bUSD\b|\bEUR\b|\bGBP\b|\bMAD\b|\bAED\b|\bSAR\b)/i

/**
 * A number, then only digits and separators — never letters. That is what stops
 * `"96 DT 52"` from being read as the single number `96…52`: the char class
 * cannot cross the `D`.
 */
const NUMBER = /\d(?:[\d\s\u00A0\u202F.,]*\d)?/g

/** Size units that follow a number which is a volume, not a price. */
const SIZE_UNIT = /^\s?(?:ml|cl|kg|g|l|%|x)\b/i

/** How far either side of a number to look for a currency marker. */
const MARKER_WINDOW = 14

/** Prices outside this range are not a K-beauty product. */
const MAX_AMOUNT = 100_000

/** Two readings of an ambiguous price are both plausible within this ratio. */
const PLAUSIBLE_LOW = 0.2
const PLAUSIBLE_HIGH = 5

/**
 * Pulls the first credible dinar price out of a block of text.
 *
 * When `referencePrice` is supplied — the price Formula K already charges for
 * this product — it also settles genuinely ambiguous strings: `1,250 DT` is
 * 1250 DT to an English formatter and 1.25 DT to a French one, and whichever
 * reading is in the right ballpark is the one that gets used.
 */
export function parsePriceToTND(text: string, referencePrice?: number): ParsedPrice | null {
  if (!text) return null

  for (const match of text.matchAll(NUMBER)) {
    const token = match[0]
    const start = match.index ?? 0
    const after = text.slice(start + token.length, start + token.length + MARKER_WINDOW)
    const before = text.slice(Math.max(0, start - MARKER_WINDOW), start)
    const window = `${before} ${after}`

    if (!TND_MARKER.test(window) || FOREIGN_MARKER.test(window)) continue
    if (SIZE_UNIT.test(after)) continue

    const parsed = toDinars(token, referencePrice)

    if (parsed) return { ...parsed, raw: token.trim() }
  }

  return null
}

/**
 * Turns a matched numeric token into dinars.
 *
 * Separator conventions, in the order they are applied:
 *  - digits only (`1250`) → itself;
 *  - both separators (`1,250.00`, `1.250,000`) → the last one is the decimal;
 *  - one separator, three digits after it and no thousands groups (`52,500`,
 *    `1.250`) → ambiguous, since it is either millimes or a thousands group. The
 *    French reading wins for a comma and the English one for a full stop, and
 *    the reference price breaks the tie when it can;
 *  - one separator, up to three digits after it, when the token already used
 *    spaces as thousands groups (`1 250,000`) → decimal, unambiguously;
 *  - one separator, one or two digits (`52,5`) → decimal;
 *  - anything else → thousands groups.
 */
function toDinars(
  token: string,
  referencePrice?: number,
): { alternate?: number; ambiguous: boolean; amount: number } | null {
  const clean = token.replace(/[\s\u00A0\u202F]/g, '')

  if (!/\d/.test(clean)) return null

  /** Spaces are never a decimal separator, so their presence rules out ambiguity. */
  const hadThousandsGroups = clean !== token

  const dots = (clean.match(/\./g) ?? []).length
  const commas = (clean.match(/,/g) ?? []).length

  let amount: number
  let alternate: number | undefined

  if (dots > 0 && commas > 0) {
    const decimal = clean.lastIndexOf('.') > clean.lastIndexOf(',') ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'

    amount = Number(clean.split(thousands).join('').replace(decimal, '.'))
  } else if (dots === 0 && commas === 0) {
    amount = Number(clean)
  } else {
    const separator = dots > 0 ? '.' : ','
    const count = dots > 0 ? dots : commas
    const digitsAfter = clean.length - clean.lastIndexOf(separator) - 1

    if (count === 1 && digitsAfter === 3 && !hadThousandsGroups) {
      if (separator === ',') {
        amount = Number(clean.replace(',', '.'))
        alternate = amount * 1000
      } else {
        amount = Number(clean.replace('.', ''))
        alternate = amount / 1000
      }
    } else if (count === 1 && digitsAfter <= 3) {
      amount = Number(clean.replace(separator, '.'))
    } else {
      amount = Number(clean.split(separator).join(''))
    }
  }

  if (!Number.isFinite(amount)) return null

  let ambiguous = alternate !== undefined

  if (
    ambiguous &&
    alternate !== undefined &&
    alternate <= MAX_AMOUNT &&
    typeof referencePrice === 'number' &&
    referencePrice > 0
  ) {
    if (!plausible(amount, referencePrice) && plausible(alternate, referencePrice)) {
      amount = alternate
      alternate = undefined
      ambiguous = false
    }
  }

  if (!(amount > 0) || amount > MAX_AMOUNT) return null

  return { alternate, ambiguous, amount: roundAmount(amount) }
}

const plausible = (value: number, referencePrice: number): boolean =>
  value >= referencePrice * PLAUSIBLE_LOW && value <= referencePrice * PLAUSIBLE_HIGH

/** `https://www.mytek.tn/foo?a=1` → `mytek.tn`. Null for anything unparseable. */
export function domainOf(url: string): string | null {
  try {
    const { hostname } = new URL(url)

    return hostname.replace(/^www\./i, '').toLowerCase() || null
  } catch {
    return null
  }
}

/** Lower-cased, accent-free, punctuation-free. `COSRX N°1` → `cosrx n 1`. */
export const normalizeTitle = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Words that appear in almost every listing and therefore say nothing about
 * whether two listings are the same product. Volume and weight units are in
 * here for the same reason: every cosmetics title has one. The number in front
 * of a unit does distinguish products (30 ml is not 50 ml), which is why
 * `tokensOf` splits `30ml` into `30` and `ml` and then drops the unit.
 */
const STOP_WORDS = new Set([
  'and',
  'avec',
  'cl',
  'de',
  'des',
  'dt',
  'du',
  'en',
  'et',
  'for',
  'kg',
  'la',
  'le',
  'les',
  'ml',
  'of',
  'oz',
  'pour',
  'price',
  'prix',
  'the',
  'tnd',
  'un',
  'une',
  'with',
])

const tokensOf = (value: string): Set<string> =>
  new Set(
    normalizeTitle(value)
      .split(' ')
      // `30ml` and `30 ml` are the same size written two ways.
      .flatMap((token) => token.replace(/(\d)([a-z])/g, '$1 $2').split(' '))
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  )

/**
 * How much of our product title appears in a competitor's listing title, from 0
 * to 1. Containment (not Jaccard) because competitor titles are usually our
 * title plus noise — "… - 100ml - Livraison gratuite".
 */
export function titleMatchScore(reference: string, candidate: string): number {
  const ours = tokensOf(reference)
  const theirs = tokensOf(candidate)

  if (ours.size === 0 || theirs.size === 0) return 0

  let matched = 0

  for (const token of ours) {
    if (theirs.has(token)) matched += 1
  }

  return matched / ours.size
}
