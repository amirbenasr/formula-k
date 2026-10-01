/**
 * Money helpers for the admin panel.
 *
 * Formula K stores every amount as a plain Tunisian-dinar value — the same
 * number the storefront prints — and *not* in the minor units (cents) that the
 * ecommerce plugin assumes for its `priceIn<CODE>` and `amount` fields. The
 * plugin's own price input therefore showed a 189 DT product as "$1.89" and
 * wrote "189" back as 18900, which the storefront then rendered as "18 900 DT".
 *
 * These helpers read and write the stored number unchanged.
 */

/** Tunisian dinar minor unit is the millime (1 DT = 1000 millimes). */
export const TND_DECIMALS = 3

/** `""` → null, `"49,9"` → 49.9, `"abc"` → null. */
export const parseAmount = (raw: string): number | null => {
  const trimmed = raw.trim().replace(',', '.')

  if (trimmed === '') return null

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

/** The value a `number` field state holds, or null when it holds nothing. */
export const toAmount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** Value → the string shown in the input, e.g. `49.9` → `"49.9"`. */
export const toDisplay = (value: unknown): string => {
  const amount = toAmount(value)

  return amount === null ? '' : String(amount)
}

/** Trim float noise (and anything past the millime) before saving. */
export const roundAmount = (value: number): number => {
  const factor = 10 ** TND_DECIMALS

  return Math.round(value * factor) / factor
}
