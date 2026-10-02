import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Route-registration guard.
 *
 * This exists because of a real bug. The competitor price lookup was first
 * declared as a root endpoint at `/competitor-prices/fetch`, which is
 * unreachable: `handleEndpoints` resolves the first path segment as a slug and
 * then replaces the endpoint list with that collection's own.
 *
 * ```js
 * // payload/dist/utilities/handleEndpoints.js
 * const firstParam = segments[0]                            // "competitor-prices"
 * if (payload.collections[firstParam]) collection = payload.collections[firstParam]
 * let endpoints = config.endpoints                          // root endpoints live here...
 * if (collection) endpoints = collection.config.endpoints   // ...but this replaces them
 * ```
 *
 * So the request 404s in production while typecheck, lint, unit tests and the
 * migration drift check all pass. Nothing else in the pipeline can see it.
 *
 * The config is imported dynamically, after the environment it reads is set,
 * because `buildConfig` is evaluated at module load.
 */

type LooseEndpoint = { method?: string; path: string }
type LooseConfig = {
  collections: { endpoints?: LooseEndpoint[] | false; slug: string }[]
  endpoints?: LooseEndpoint[] | false
  globals?: { slug: string }[]
}

let config: LooseConfig

const asList = (endpoints: LooseEndpoint[] | false | undefined): LooseEndpoint[] =>
  Array.isArray(endpoints) ? endpoints : []

/**
 * Root endpoints whose first path segment is a collection or global slug, and
 * which therefore can never be matched. Returns the offending paths.
 *
 * Pure and exported for the test below, so the guard itself is provably able to
 * fail — a check that cannot fail is worse than no check.
 */
const collidingRootEndpoints = ({
  collections,
  endpoints,
  globals,
}: {
  collections: { slug: string }[]
  endpoints: LooseEndpoint[]
  globals: { slug: string }[]
}): string[] => {
  const reserved = new Set([...collections.map(({ slug }) => slug), ...globals.map(({ slug }) => slug)])

  return endpoints
    .map(({ path }) => path)
    .filter((path) => {
      const firstSegment = path.split('/').filter(Boolean)[0]

      return Boolean(firstSegment) && reserved.has(firstSegment)
    })
}

beforeAll(async () => {
  process.env.PAYLOAD_SECRET ||= 'unit-test-secret'
  process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost:5432/unused'

  // `buildConfig` returns a promise and sanitizes the config, which is where
  // Payload injects the default CRUD endpoints, so it has to be awaited.
  const imported = (await import('@/payload.config')) as unknown as {
    default: Promise<LooseConfig>
  }

  config = await imported.default
})

describe('the collision guard itself', () => {
  it('flags the exact bug that shipped', () => {
    expect(
      collidingRootEndpoints({
        collections: [{ slug: 'products' }, { slug: 'competitor-prices' }],
        endpoints: [{ method: 'post', path: '/competitor-prices/fetch' }],
        globals: [{ slug: 'header' }],
      }),
    ).toEqual(['/competitor-prices/fetch'])
  })

  it('flags globals too, and leaves honest endpoints alone', () => {
    expect(
      collidingRootEndpoints({
        collections: [{ slug: 'products' }],
        endpoints: [
          { method: 'get', path: '/header/preview' },
          { method: 'post', path: '/admin-ai/chat' },
          { method: 'get', path: '/og' },
        ],
        globals: [{ slug: 'header' }],
      }),
    ).toEqual(['/header/preview'])
  })
})

describe('endpoint routing in this app', () => {
  it('mounts the competitor price lookup on its collection', () => {
    const collection = config.collections.find(({ slug }) => slug === 'competitor-prices')
    const endpoint = asList(collection?.endpoints).find(
      ({ method, path }) => method === 'post' && path === '/fetch',
    )

    // The tab posts to /api/competitor-prices/fetch: Payload strips /api and the
    // collection slug before matching, leaving /fetch.
    expect(endpoint).toBeDefined()
  })

  it('declares no competing POST route on that collection', () => {
    // Payload also injects its CRUD routes (POST `/` for create and
    // POST `/:id/duplicate`); neither matches the single segment `/fetch`.
    const collection = config.collections.find(({ slug }) => slug === 'competitor-prices')
    const singleSegmentPosts = asList(collection?.endpoints)
      .filter(({ method }) => method === 'post')
      .map(({ path }) => path)
      .filter((path) => /^\/[^/]+$/.test(path))

    expect(singleSegmentPosts).toEqual(['/fetch'])
  })

  it('has no root endpoint shadowed by a collection or global slug', () => {
    expect(
      collidingRootEndpoints({
        collections: config.collections,
        endpoints: asList(config.endpoints),
        globals: config.globals ?? [],
      }),
    ).toEqual([])
  })

  it('loaded a real config, so the checks above are not vacuous', () => {
    expect(config.collections.length).toBeGreaterThan(5)
    expect(config.collections.map(({ slug }) => slug)).toContain('products')
  })
})
