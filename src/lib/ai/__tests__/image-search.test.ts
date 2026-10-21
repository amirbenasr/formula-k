import { describe, expect, it } from 'vitest'

import {
  buildQueryVariants,
  parseCommonsResponse,
  parseOpenverseResults,
  rankImageCandidates,
  type WebImageCandidate,
} from '../image-search'

describe('parseOpenverseResults', () => {
  it('maps a result to a candidate with credit and licence', () => {
    const [candidate] = parseOpenverseResults({
      results: [
        {
          creator: 'Jane Doe',
          foreign_landing_url: 'https://www.flickr.com/photos/jane/123',
          height: 1200,
          license: 'by',
          license_version: '4.0',
          title: 'Anua Heartleaf Toner',
          url: 'https://live.staticflickr.com/1/2/3.jpg',
          width: 1200,
        },
      ],
    })

    expect(candidate).toEqual({
      credit: 'Jane Doe · by 4.0',
      height: 1200,
      license: 'by 4.0',
      provider: 'openverse',
      sourceUrl: 'https://www.flickr.com/photos/jane/123',
      title: 'Anua Heartleaf Toner',
      url: 'https://live.staticflickr.com/1/2/3.jpg',
      width: 1200,
    })
  })

  it('drops results without a usable image URL', () => {
    const candidates = parseOpenverseResults({
      results: [
        { title: 'no url' },
        { title: 'javascript', url: 'javascript:alert(1)' },
        { title: 'relative', url: '/media/x.jpg' },
      ],
    })

    expect(candidates).toEqual([])
  })

  it('decodes HTML entities in titles', () => {
    const [candidate] = parseOpenverseResults({
      results: [{ title: 'Toner &amp; Cream', url: 'https://x.test/a.jpg' }],
    })

    expect(candidate.title).toBe('Toner & Cream')
  })

  it('tolerates a malformed payload', () => {
    expect(parseOpenverseResults(null)).toEqual([])
    expect(parseOpenverseResults({})).toEqual([])
    expect(parseOpenverseResults({ results: 'nope' })).toEqual([])
  })
})

describe('parseCommonsResponse', () => {
  const payload = {
    query: {
      pages: {
        '42': {
          imageinfo: [
            {
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Anua_toner.jpg',
              extmetadata: {
                Artist: { value: '<a href="#">Bob Smith</a>' },
                LicenseShortName: { value: 'CC BY-SA 4.0' },
              },
              thumbheight: 900,
              thumburl: 'https://upload.wikimedia.org/thumb/anua.jpg',
              thumbwidth: 1200,
            },
          ],
          title: 'File:Anua toner.jpg',
        },
      },
    },
  }

  it('prefers the scaled thumbnail and strips HTML from the credit', () => {
    const [candidate] = parseCommonsResponse(payload)

    expect(candidate).toEqual({
      credit: 'Bob Smith · CC BY-SA 4.0',
      height: 900,
      license: 'CC BY-SA 4.0',
      provider: 'commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Anua_toner.jpg',
      title: 'Anua toner.jpg',
      url: 'https://upload.wikimedia.org/thumb/anua.jpg',
      width: 1200,
    })
  })

  it('falls back to the original file when there is no thumbnail', () => {
    const [candidate] = parseCommonsResponse({
      query: {
        pages: {
          '1': {
            imageinfo: [{ url: 'https://upload.wikimedia.org/full/anua.jpg' }],
            title: 'File:Anua.jpg',
          },
        },
      },
    })

    expect(candidate.url).toBe('https://upload.wikimedia.org/full/anua.jpg')
    expect(candidate.credit).toBeUndefined()
  })

  it('tolerates a malformed payload', () => {
    expect(parseCommonsResponse(null)).toEqual([])
    expect(parseCommonsResponse({ query: {} })).toEqual([])
    expect(parseCommonsResponse({ query: { pages: { '1': {} } } })).toEqual([])
  })
})

describe('buildQueryVariants', () => {
  /**
   * Both providers are AND-matched, so "anua heartleaf toner bottle" returns
   * nothing at all. Relaxing is what makes the search usable — but it must stop
   * at two words, because a one-word query returns printer toner for "toner".
   */
  it('keeps the precise query first', () => {
    expect(buildQueryVariants('Anua Heartleaf Toner')[0]).toBe('Anua Heartleaf Toner')
  })

  it('drops packaging filler and relaxes to the product words', () => {
    const variants = buildQueryVariants('anua heartleaf toner bottle')

    expect(variants).toContain('heartleaf toner')
    expect(variants).not.toContain('bottle')
  })

  it('never relaxes to a single word', () => {
    for (const variant of buildQueryVariants('laneige lip sleeping mask')) {
      expect(variant.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('returns just the query when there is nothing to relax', () => {
    expect(buildQueryVariants('toner')).toEqual(['toner'])
  })

  it('does not repeat variants', () => {
    const variants = buildQueryVariants('anua toner')

    expect(new Set(variants).size).toBe(variants.length)
  })
})

describe('rankImageCandidates', () => {
  const candidate = (overrides: Partial<WebImageCandidate>): WebImageCandidate => ({
    provider: 'openverse',
    title: 'Untitled',
    url: 'https://example.test/a.jpg',
    ...overrides,
  })

  it('prefers the candidate whose title covers the query', () => {
    const printer = candidate({ title: 'Four Samsung laser toner cartridges' })
    const skincare = candidate({ title: 'Anua Heartleaf toner bottle' })

    expect(rankImageCandidates([printer, skincare], 'anua toner')).toEqual([skincare, printer])
  })

  it('uses tags as well as the title', () => {
    const untitled = candidate({ tags: ['anua', 'toner'], title: 'IMG_0001' })
    const other = candidate({ title: 'Sunscreen in the desert' })

    expect(rankImageCandidates([other, untitled], 'anua toner')[0]).toBe(untitled)
  })

  it('leaves the order untouched when nothing matches', () => {
    const first = candidate({ title: 'Printer toner' })
    const second = candidate({ title: 'Desert' })

    expect(rankImageCandidates([first, second], 'anua heartleaf')).toEqual([first, second])
  })

  it('is stable for equally relevant candidates', () => {
    const first = candidate({ title: 'toner one' })
    const second = candidate({ title: 'toner two' })

    expect(rankImageCandidates([first, second], 'toner')).toEqual([first, second])
  })
})
