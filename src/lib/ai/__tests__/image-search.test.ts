import { afterEach, describe, expect, it, vi } from 'vitest'

import { MIN_IMAGE_DIMENSION, parseSerpApiImages, searchWebImages } from '../image-search'

/**
 * A note on why this suite is shaped around SerpAPI's payload rather than a
 * provider-agnostic one: the previous version of this feature used Openverse and
 * Wikimedia Commons and was removed, because those corpora do not contain branded
 * beauty products. The mapping below is the whole contract with the provider, so
 * the traps in it — a result with no `original`, an `original` that is really a
 * thumbnail, HTML entities in titles — are what these tests pin down.
 */
describe('parseSerpApiImages', () => {
  const result = (overrides: Record<string, unknown> = {}) => ({
    is_product: true,
    link: 'https://www.anua.com/products/heartleaf-toner',
    original: 'https://anua.com/cdn/shop/files/heartleaf-77.jpg',
    original_height: 1200,
    original_width: 1200,
    source: 'Anua',
    thumbnail: 'https://serpapi.com/searches/abc/images/e60ab271.jpeg',
    title: 'Anua Heartleaf 77% Soothing Toner',
    ...overrides,
  })

  it('maps a result to a candidate with everything the download needs', () => {
    const [candidate] = parseSerpApiImages({ images_results: [result()] })

    expect(candidate).toEqual({
      credit: 'Anua',
      fallbackUrl: 'https://serpapi.com/searches/abc/images/e60ab271.jpeg',
      height: 1200,
      isProduct: true,
      pageUrl: 'https://www.anua.com/products/heartleaf-toner',
      provider: 'serpapi',
      title: 'Anua Heartleaf 77% Soothing Toner',
      url: 'https://anua.com/cdn/shop/files/heartleaf-77.jpg',
      width: 1200,
    })
  })

  it('drops results with no original image — a thumbnail cannot become a product photo', () => {
    expect(
      parseSerpApiImages({ images_results: [{ thumbnail: 'https://x.test/t.jpg' }] }),
    ).toEqual([])
  })

  it('drops an "original" that is only thumbnail sized', () => {
    const candidates = parseSerpApiImages({
      images_results: [result({ original_height: 90, original_width: 120 })],
    })

    expect(candidates).toEqual([])
  })

  it('keeps results whose dimensions are missing, and still tries the download', () => {
    const [candidate] = parseSerpApiImages({
      images_results: [result({ original_height: undefined, original_width: undefined })],
    })

    expect(candidate.url).toBe('https://anua.com/cdn/shop/files/heartleaf-77.jpg')
    expect(candidate.width).toBeUndefined()
    expect(candidate.height).toBeUndefined()
  })

  it('treats the dimension floor as inclusive', () => {
    const candidates = parseSerpApiImages({
      images_results: [
        result({ original_height: MIN_IMAGE_DIMENSION, original_width: MIN_IMAGE_DIMENSION }),
      ],
    })

    expect(candidates).toHaveLength(1)
  })

  it('falls back to the hostname when the result has no source label', () => {
    const [candidate] = parseSerpApiImages({
      images_results: [result({ source: undefined })],
    })

    expect(candidate.credit).toBe('anua.com')
  })

  it('strips HTML and decodes entities in titles and sources', () => {
    const [candidate] = parseSerpApiImages({
      images_results: [result({ source: 'YesStyle &amp; Co', title: '<b>Toner</b> &amp; Cream' })],
    })

    expect(candidate.title).toBe('Toner & Cream')
    expect(candidate.credit).toBe('YesStyle & Co')
  })

  it('rejects non-http image URLs', () => {
    const candidates = parseSerpApiImages({
      images_results: [
        result({ original: 'data:image/png;base64,AAAA' }),
        result({ original: '/relative/path.jpg' }),
      ],
    })

    expect(candidates).toEqual([])
  })

  it('tolerates a malformed payload', () => {
    expect(parseSerpApiImages(null)).toEqual([])
    expect(parseSerpApiImages({})).toEqual([])
    expect(parseSerpApiImages({ images_results: 'nope' })).toEqual([])
    expect(parseSerpApiImages({ images_results: [null, 42, {}] })).toEqual([])
  })
})

describe('searchWebImages', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports a disabled provider without touching the network', async () => {
    vi.stubEnv('IMAGE_SEARCH_PROVIDER', 'none')

    const result = await searchWebImages('anua toner')

    expect(result.candidates).toEqual([])
    expect(result.note).toMatch(/disabled/i)
  })

  it('rejects an unknown provider by name', async () => {
    vi.stubEnv('IMAGE_SEARCH_PROVIDER', 'openverse')

    const result = await searchWebImages('anua toner')

    expect(result.candidates).toEqual([])
    expect(result.note).toMatch(/Unsupported IMAGE_SEARCH_PROVIDER "openverse"/)
  })

  it('explains a missing API key instead of throwing', async () => {
    vi.stubEnv('IMAGE_SEARCH_PROVIDER', 'serpapi')
    vi.stubEnv('SERPAPI_API_KEY', '')

    const result = await searchWebImages('anua toner')

    expect(result.candidates).toEqual([])
    expect(result.note).toMatch(/SERPAPI_API_KEY is not set/)
  })

  it('rejects an empty query', async () => {
    const result = await searchWebImages('   ')

    expect(result.candidates).toEqual([])
    expect(result.note).toMatch(/Empty search query/)
  })

  it('never throws when the provider answers with an error field', async () => {
    vi.stubEnv('IMAGE_SEARCH_PROVIDER', 'serpapi')
    vi.stubEnv('SERPAPI_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 200 })),
    )

    const result = await searchWebImages('anua toner')

    expect(result.candidates).toEqual([])
    expect(result.note).toMatch(/Invalid API key/)
  })

  it('never throws when the provider is unreachable', async () => {
    vi.stubEnv('IMAGE_SEARCH_PROVIDER', 'serpapi')
    vi.stubEnv('SERPAPI_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND')
      }),
    )

    const result = await searchWebImages('anua toner')

    expect(result.candidates).toEqual([])
    expect(result.timedOut).toBe(false)
    expect(result.note).toMatch(/could not be reached/)
  })

  /**
   * The bug this suite was extended for.
   *
   * A cold Google Images search takes SerpAPI about a minute. The original 20s
   * timeout aborted every one of them, so the chat reported a provider timeout
   * while SerpAPI recorded a success — a failure that never happened. SerpAPI
   * finishes and caches the search even after we hang up, so one identical retry
   * is both correct and cheap.
   */
  describe('timeouts', () => {
    const result = {
      images_results: [
        {
          original: 'https://anua.com/cdn/shop/files/toner.jpg',
          original_height: 1200,
          original_width: 1200,
          source: 'Anua',
          title: 'Anua Heartleaf Toner',
        },
      ],
    }

    const timeout = () =>
      Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      })

    const stub = (handler: (url: string, attempt: number) => Response | Promise<Response>) => {
      const urls: string[] = []

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: unknown) => {
          urls.push(String(input))

          return handler(String(input), urls.length)
        }),
      )

      return urls
    }

    const apiKey = () => {
      vi.stubEnv('IMAGE_SEARCH_PROVIDER', 'serpapi')
      vi.stubEnv('SERPAPI_API_KEY', 'test-key')
    }

    it('retries the identical query once after a timeout, and succeeds on the cached result', async () => {
      apiKey()

      const urls = stub((_url, attempt) => {
        if (attempt === 1) throw timeout()
        return new Response(JSON.stringify(result), { status: 200 })
      })

      const search = await searchWebImages('anua toner')

      expect(urls).toHaveLength(2)
      // The retry must be the same request: a different query would be another
      // minute-long cold search instead of a cache hit.
      expect(urls[0]).toBe(urls[1])
      expect(search.candidates).toHaveLength(1)
      expect(search.timedOut).toBeUndefined()
      expect(typeof search.elapsedMs).toBe('number')
    })

    it('reports a timeout as a timeout, not as "no results"', async () => {
      apiKey()
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      stub(() => {
        throw timeout()
      })

      const search = await searchWebImages('anua toner')

      expect(search.candidates).toEqual([])
      expect(search.timedOut).toBe(true)
      expect(search.note).toMatch(/timed out/)
      expect(search.note).toMatch(/retry the SAME query/)
    })

    it('tries exactly twice, then stops', async () => {
      apiKey()
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const urls = stub(() => {
        throw timeout()
      })

      await searchWebImages('anua toner')

      expect(urls).toHaveLength(2)
    })

    it('does not retry an HTTP error, because repeating it only burns quota', async () => {
      apiKey()
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const urls = stub(() => new Response('nope', { status: 500 }))

      const search = await searchWebImages('anua toner')

      expect(urls).toHaveLength(1)
      expect(search.timedOut).toBe(false)
      expect(search.note).toMatch(/HTTP 500/)
    })

    it('logs every attempt with the query, elapsed time and outcome', async () => {
      apiKey()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      stub(() => {
        throw timeout()
      })

      await searchWebImages('anua toner')

      expect(warn).toHaveBeenCalledTimes(2)
      expect(warn.mock.calls[0][0]).toMatch(/\[ai\/search-images\] fail query="anua toner"/)
      expect(warn.mock.calls[0][0]).toMatch(/elapsed=\d+ms/)
      expect(warn.mock.calls[0][0]).toMatch(/timedOut=true/)
    })
  })
})
