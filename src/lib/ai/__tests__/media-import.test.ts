import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { User } from '@/payload-types'

import { assertFetchableUrl, ImageImportError, importImageFromUrl } from '../media-import'

/**
 * These guard server-side fetches of URLs a language model chose. Getting this
 * wrong turns the chat into an SSRF primitive against the host network, so the
 * cases below are the ones that actually matter.
 */
describe('assertFetchableUrl', () => {
  it('accepts a public https URL', () => {
    expect(assertFetchableUrl('https://live.staticflickr.com/1/2/3.jpg').hostname).toBe(
      'live.staticflickr.com',
    )
  })

  it('accepts a public http URL', () => {
    expect(assertFetchableUrl('http://example.com/a.jpg').protocol).toBe('http:')
  })

  it('accepts a public address just outside the private 172.16/12 range', () => {
    expect(assertFetchableUrl('http://172.32.0.1/a.jpg').hostname).toBe('172.32.0.1')
  })

  it('rejects non-HTTP schemes', () => {
    expect(() => assertFetchableUrl('file:///etc/passwd')).toThrow(ImageImportError)
    expect(() => assertFetchableUrl('javascript:alert(1)')).toThrow(/only http\(s\) is allowed/)
    expect(() => assertFetchableUrl('data:image/png;base64,AAAA')).toThrow(ImageImportError)
  })

  it('rejects a string that is not a URL', () => {
    expect(() => assertFetchableUrl('anua toner')).toThrow(/is not a valid URL/)
  })

  it.each([
    'http://localhost:3000/api/media',
    'http://127.0.0.1/a.jpg',
    'http://0.0.0.0/a.jpg',
    'http://10.1.2.3/a.jpg',
    'http://192.168.1.10/a.jpg',
    'http://172.16.0.1/a.jpg',
    'http://172.31.255.255/a.jpg',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/a.jpg',
    'http://metadata.google.internal/computeMetadata/v1/',
  ])('rejects the private or loopback target %s', (url) => {
    expect(() => assertFetchableUrl(url)).toThrow(/private and loopback addresses/)
  })
})

/**
 * The download ladder.
 *
 * Image search returns URLs on the source's own CDN, and retail CDNs routinely
 * refuse a request that does not look like a browser on their page. Falling back
 * to the provider's thumbnail copy is what keeps a blocked CDN from turning into a
 * dead end — but it must never mask a real failure, so both attempts have to stay
 * visible in the error.
 */
describe('importImageFromUrl — fallback ladder', () => {
  const SOURCE = 'https://anua.com/cdn/shop/files/toner.jpg'
  const FALLBACK = 'https://serpapi.com/searches/abc/images/e60ab271.jpeg'
  const PAGE = 'https://www.anua.com/products/toner'

  let jpeg: Buffer

  beforeAll(async () => {
    jpeg = await sharp({
      create: { background: { b: 235, g: 240, r: 245 }, channels: 3, height: 1200, width: 1200 },
    })
      .jpeg({ quality: 80 })
      .toBuffer()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  type Call = { headers: Record<string, string>; url: string }

  const stubFetch = (respond: (url: string) => Response) => {
    const calls: Call[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: { headers?: Record<string, string> }) => {
        const url = String(input)
        calls.push({ headers: init?.headers ?? {}, url })

        return respond(url)
      }),
    )

    return calls
  }

  const response = (
    body: Buffer,
    { status = 200, type = 'image/jpeg', url }: { status?: number; type?: null | string; url: string },
  ): Response =>
    ({
      arrayBuffer: async () => body,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? type : null) },
      ok: status >= 200 && status < 300,
      status,
      url,
    }) as unknown as Response

  const fakePayload = () => {
    const calls: unknown[] = []

    const payload = {
      create: vi.fn(async (args: unknown) => {
        calls.push(args)
        const { data } = args as { data: { sourceUrl: string } }

        return { id: 7, sourceUrl: data.sourceUrl, url: '/api/media/file/toner.jpg' }
      }),
    } as unknown as Payload

    return { calls, payload }
  }

  const user = { id: 1 } as unknown as User

  it('falls back to the provider copy when the source CDN refuses', async () => {
    const calls = stubFetch((url) =>
      url === SOURCE
        ? response(Buffer.from('forbidden'), { status: 403, url })
        : response(jpeg, { url }),
    )
    const { calls: created, payload } = fakePayload()

    const image = await importImageFromUrl({
      alt: 'Anua Heartleaf Toner',
      credit: 'Anua',
      fallbackUrl: FALLBACK,
      payload,
      referer: PAGE,
      sourcePageUrl: PAGE,
      url: SOURCE,
      user,
    })

    expect(image.id).toBe(7)
    expect(calls.map((call) => call.url)).toEqual([SOURCE, FALLBACK])

    const args = created[0] as {
      collection: string
      data: Record<string, unknown>
      file: { mimetype: string; size: number }
      overrideAccess: boolean
    }

    expect(args.collection).toBe('media')
    expect(args.overrideAccess).toBe(false)
    expect(args.data).toMatchObject({
      alt: 'Anua Heartleaf Toner',
      credit: 'Anua',
      source: 'web',
      sourceUrl: PAGE,
    })
    expect(args.file.mimetype).toBe('image/jpeg')
    expect(args.file.size).toBe(jpeg.length)
  })

  it('sends the page as Referer, because CDNs refuse foreign image requests', async () => {
    const calls = stubFetch((url) => response(jpeg, { url }))
    const { payload } = fakePayload()

    await importImageFromUrl({
      alt: 'Anua Heartleaf Toner',
      fallbackUrl: FALLBACK,
      payload,
      referer: PAGE,
      url: SOURCE,
      user,
    })

    expect(calls[0].headers.referer).toBe(PAGE)
    // The direct source worked, so the fallback must not have been touched.
    expect(calls).toHaveLength(1)
  })

  it('reports both attempts when neither URL yields an image', async () => {
    stubFetch((url) => response(Buffer.from('<html>nope</html>'), { status: 403, url }))
    const { calls, payload } = fakePayload()

    await expect(
      importImageFromUrl({
        alt: 'Anua Heartleaf Toner',
        fallbackUrl: FALLBACK,
        payload,
        url: SOURCE,
        user,
      }),
    ).rejects.toThrow(/source image: .*403.*fallback image: .*403/)

    expect(calls).toHaveLength(0)
  })

  it('treats a 200 carrying HTML as a failure and tries the fallback', async () => {
    stubFetch((url) =>
      url === SOURCE
        ? response(Buffer.from('<html>not an image</html>'), { type: 'text/html', url })
        : response(jpeg, { url }),
    )
    const { payload } = fakePayload()

    const image = await importImageFromUrl({
      alt: 'Anua Heartleaf Toner',
      fallbackUrl: FALLBACK,
      payload,
      url: SOURCE,
      user,
    })

    expect(image.id).toBe(7)
  })

  it('does not fetch the same URL twice when the fallback equals the source', async () => {
    const calls = stubFetch((url) => response(jpeg, { url }))
    const { payload } = fakePayload()

    await importImageFromUrl({
      alt: 'Anua Heartleaf Toner',
      fallbackUrl: SOURCE,
      payload,
      url: SOURCE,
      user,
    })

    expect(calls).toHaveLength(1)
  })

  it('refuses an empty alt text before fetching anything', async () => {
    const calls = stubFetch((url) => response(jpeg, { url }))
    const { payload } = fakePayload()

    await expect(
      importImageFromUrl({ alt: '   ', payload, url: SOURCE, user }),
    ).rejects.toThrow(/needs alt text/)

    expect(calls).toHaveLength(0)
  })
})
