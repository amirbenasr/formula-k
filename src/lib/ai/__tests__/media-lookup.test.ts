import { describe, expect, it } from 'vitest'

import { scoreMediaMatch, STRONG_MATCH } from '../media-lookup'

/**
 * The assistant decides "do we already own this image?" from these scores, so the
 * cases here are the real queries the store produces: a product name against the
 * alt text an admin actually writes.
 */
describe('scoreMediaMatch', () => {
  it('scores an exact alt-text match as 1', () => {
    expect(
      scoreMediaMatch('Anua Heartleaf 77 Toner', { alt: 'Anua Heartleaf 77 Toner' }),
    ).toBe(1)
  })

  it('matches a product name spread across the alt text', () => {
    const score = scoreMediaMatch('anua toner', {
      alt: 'Anua Heartleaf 77% Soothing Toner 250ml',
    })

    expect(score).toBe(1)
    expect(score).toBeGreaterThanOrEqual(STRONG_MATCH)
  })

  it('ignores accents and case, which is how French titles are typed', () => {
    expect(scoreMediaMatch('creme solaire', { alt: 'Crème Solaire SPF50+' })).toBe(1)
    expect(scoreMediaMatch('CRÈME SOLAIRE', { alt: 'creme solaire spf50' })).toBe(1)
  })

  it('scores an exact filename match highly', () => {
    expect(scoreMediaMatch('anua heartleaf 01', { filename: 'anua-heartleaf-01.jpg' })).toBe(0.95)
  })

  it('treats a four-character prefix as a partial hit', () => {
    // "toniq" vs "tonique" — a truncated or abbreviated product word.
    const score = scoreMediaMatch('toniq', { alt: 'Anua Tonique 77' })

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it('does not match a prefix shorter than four characters', () => {
    // "ton" must not match half the library.
    expect(scoreMediaMatch('ton', { alt: 'Anua Tonique 77' })).toBe(0)
  })

  it('scores unrelated text as 0', () => {
    expect(scoreMediaMatch('sunscreen', { alt: 'Anua Heartleaf Toner' })).toBe(0)
  })

  it('scores an empty query or empty candidate as 0', () => {
    expect(scoreMediaMatch('', { alt: 'Anua Toner' })).toBe(0)
    expect(scoreMediaMatch('   ', { alt: 'Anua Toner' })).toBe(0)
    expect(scoreMediaMatch('anua', { alt: '', filename: undefined })).toBe(0)
  })

  it('drops stop words so they cannot inflate coverage', () => {
    // "the"/"of" carry no signal; of four query tokens only "anua" is present.
    expect(scoreMediaMatch('the sunscreen of anua', { alt: 'Anua Toner' })).toBe(0.5)
  })

  it('keeps the product number distinct', () => {
    // 77 and 80 are different products; the token set must not conflate them.
    expect(scoreMediaMatch('anua 77', { alt: 'Anua 80 Toner' })).toBeLessThan(1)
  })

  it('is symmetric enough to match a query that is a substring of the alt', () => {
    const score = scoreMediaMatch('lip sleeping mask', {
      alt: 'Laneige Lip Sleeping Mask EX Berry 3g',
    })

    expect(score).toBeGreaterThanOrEqual(STRONG_MATCH)
  })
})
