import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

import { CACHE_TAGS } from '@/utilities/cacheTags'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug.
 *
 * Globals render in the root layout, so they are on the critical path of every
 * page. They are invalidated on save by `createGlobalRevalidateHook`; the hourly
 * `revalidate` is only a safety net in case a hook never ran.
 */
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0) =>
  unstable_cache(async () => getGlobal<T>(slug, depth), [slug, String(depth)], {
    revalidate: 3600,
    tags: [CACHE_TAGS.global(slug)],
  })
