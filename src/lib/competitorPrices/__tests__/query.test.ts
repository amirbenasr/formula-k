import { describe, expect, it } from 'vitest'

import { buildSearchQuery, siteFilter, toSearchTerms } from '../query'

describe('toSearchTerms', () => {
  it('flattens the title that shipped, quotes and dashes included', () => {
    expect(toSearchTerms('Anua – Niacinamide Dark Spot Correcting Serum – 30ml')).toBe(
      'Anua Niacinamide Dark Spot Correcting Serum 30ml',
    )
  })

  it('strips accents so a French listing still matches', () => {
    expect(toSearchTerms('Sérum Éclat — Édition Limitée')).toBe('Serum Eclat Edition Limitee')
  })

  it('drops punctuation that Google would read as operators', () => {
    expect(toSearchTerms('COSRX | Snail 96 (100ml)')).toBe('COSRX Snail 96 100ml')
    expect(toSearchTerms('-50% promo')).toBe('50 promo')
  })

  it('collapses whitespace and returns empty for an unusable title', () => {
    expect(toSearchTerms('  Anua    Serum  ')).toBe('Anua Serum')
    expect(toSearchTerms('– — |')).toBe('')
  })
})

describe('siteFilter', () => {
  it('restricts to the TLD when any Tunisian host is accepted', () => {
    // The default list must NOT become the site filter: isCompetitorDomain
    // accepts any .tn host, so filtering to four domains would silently throw
    // away every other Tunisian shop.
    expect(siteFilter({ domains: ['mytek.tn', 'jumia.com.tn'], strict: false })).toBe('site:.tn')
  })

  it('adds explicitly configured domains outside .tn', () => {
    expect(siteFilter({ domains: ['mytek.tn', 'example.com'], strict: false })).toBe(
      '(site:.tn OR site:example.com)',
    )
  })

  it('lists the configured domains in strict mode', () => {
    expect(siteFilter({ domains: ['mytek.tn', 'wiki.tn'], strict: true })).toBe(
      '(site:mytek.tn OR site:wiki.tn)',
    )
    expect(siteFilter({ domains: ['mytek.tn'], strict: true })).toBe('site:mytek.tn')
  })
})

describe('buildSearchQuery', () => {
  it('builds the query that a Tunisian shopper would type', () => {
    expect(
      buildSearchQuery({
        domains: ['mytek.tn'],
        strict: false,
        title: 'Anua – Niacinamide Dark Spot Correcting Serum – 30ml',
      }),
    ).toBe('prix Anua Niacinamide Dark Spot Correcting Serum 30ml site:.tn')
  })

  it('never quotes the title', () => {
    expect(buildSearchQuery({ domains: [], strict: false, title: 'Anua Serum' })).not.toContain('"')
  })
})
