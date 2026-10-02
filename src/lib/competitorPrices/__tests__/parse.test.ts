import { describe, expect, it } from 'vitest'

import { domainOf, normalizeTitle, parsePriceToTND, titleMatchScore } from '../parse'

describe('parsePriceToTND', () => {
  it('reads a plain dinar price', () => {
    expect(parsePriceToTND('Serum COSRX — 52 DT')?.amount).toBe(52)
    expect(parsePriceToTND('1250 TND')?.amount).toBe(1250)
    expect(parsePriceToTND('Prix : 189,000 dinars')?.amount).toBe(189)
  })

  it('treats three decimals as millimes, not as a thousands group', () => {
    // 52 DT 500 millimes, not 52 500 DT.
    expect(parsePriceToTND('Prix : 52,500 DT')?.amount).toBe(52.5)
    // The same figure written with spaces as the thousands group is unambiguous.
    expect(parsePriceToTND('1 250,000 DT')).toMatchObject({ amount: 1250, ambiguous: false })
  })

  it('keeps the raw text it matched, so the admin can audit the figure', () => {
    expect(parsePriceToTND('à partir de 52,500 DT')?.raw).toBe('52,500')
  })

  it('reads a full stop with three digits as a thousands group', () => {
    expect(parsePriceToTND('1.250 DT')?.amount).toBe(1250)
  })

  it('flags genuinely ambiguous prices and lets the reference price settle them', () => {
    const ambiguous = parsePriceToTND('1,250 DT')

    expect(ambiguous).toMatchObject({ amount: 1.25, ambiguous: true })

    // Formula K charges 1250 DT, so the English reading is the right one.
    expect(parsePriceToTND('1,250 DT', 1250)).toMatchObject({ amount: 1250, ambiguous: false })
    // Formula K charges 1.25 DT, so the French reading stands.
    expect(parsePriceToTND('1,250 DT', 1.25)).toMatchObject({ amount: 1.25 })
  })

  it('refuses numbers that are not prices', () => {
    // The product name is mostly numbers; none of them is a price.
    expect(parsePriceToTND('COSRX Snail 96 Mucin Power Essence 100ml')).toBeNull()
    // A size unit directly after the number disqualifies it.
    expect(parsePriceToTND('Flacon 100 ml DT')).toBeNull()
    expect(parsePriceToTND('Rupture de stock')).toBeNull()
    expect(parsePriceToTND('')).toBeNull()
  })

  it('ignores foreign currencies', () => {
    expect(parsePriceToTND('€ 12,50')).toBeNull()
    expect(parsePriceToTND('$52.00')).toBeNull()
    expect(parsePriceToTND('52 EUR')).toBeNull()
  })

  it('takes the first credible price when a snippet holds several', () => {
    expect(parsePriceToTND('De 52 DT à 61 DT')?.amount).toBe(52)
  })

  it('rejects amounts outside anything a K-beauty product could cost', () => {
    expect(parsePriceToTND('999999 DT')).toBeNull()
  })
})

describe('domainOf', () => {
  it('reduces a URL to its hostname', () => {
    expect(domainOf('https://www.mytek.tn/produit/cosrx?a=1')).toBe('mytek.tn')
    expect(domainOf('https://jumia.com.tn/foo')).toBe('jumia.com.tn')
  })

  it('returns null for anything unparseable', () => {
    expect(domainOf('not a url')).toBeNull()
  })
})

describe('titleMatchScore', () => {
  it('scores a competitor listing that contains our title highly', () => {
    const score = titleMatchScore(
      'COSRX Snail 96 Mucin Power Essence 100ml',
      'COSRX Snail 96 Mucin Power Essence 100ml - Livraison gratuite',
    )

    expect(score).toBeGreaterThanOrEqual(0.9)
  })

  it('scores an unrelated listing low', () => {
    const score = titleMatchScore(
      'COSRX Snail 96 Mucin Power Essence 100ml',
      'Écouteurs Bluetooth sans fil',
    )

    expect(score).toBeLessThan(0.25)
  })

  it('ignores accents, case and filler words', () => {
    expect(normalizeTitle('Sérum N°1 — Éclat')).toBe('serum n 1 eclat')
    expect(
      titleMatchScore('Sérum éclat', 'SERUM ECLAT pour la peau'),
    ).toBe(1)
  })
})
