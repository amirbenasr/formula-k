# 8 — Performance & Caching

**Audited:** measurement session against a local production build (`next build` + `next start`).
**Scope:** rendering strategy, database round trips, image delivery.

---

## 1. The short version

Three things made the storefront slow, and all three are fixed:

| # | Problem | Effect | Fix |
| --- | --- | --- | --- |
| 1 | Every catalogue page was server-rendered on demand | A Vercel function cold start **plus** a database round trip on every visit, including for anonymous shoppers who could be served a static file | Product pages are prerendered + ISR; every DB read is cached |
| 2 | No durable data cache for products, categories or brands | The homepage alone ran 5 queries per render, one of which scanned up to 500 orders and their line items | `unstable_cache` per feed, invalidated by Payload hooks |
| 3 | Images were re-optimised every 60 s and streamed through the app | Vercel re-encoded every photo once a minute per size; media bytes were served by a serverless function that had already read the database | 31-day `minimumCacheTTL`, AVIF, immutable headers on `/api/media/file/*`, optional public R2 URLs |

## 2. Measured results

Route table, `next build` output:

| Route | Before | After |
| --- | --- | --- |
| `/` | Static, `revalidate: false` (frozen until redeploy) | Static, invalidated on save, 10 min safety net |
| `/products/[slug]` | **Dynamic** (SSR + DB on every visit) | **SSG**, 24 paths prerendered, 1 h ISR |
| `/brands` | Static, `revalidate: false` | Static, tag-invalidated, 1 h |
| `/shop`, `/shop/[slug]`, `/brands/[slug]` | Dynamic, DB query per request | Dynamic (they read `searchParams`), **zero DB queries on a cache hit** |
| `/rewards`, `/checkout`, `/reset-password`, … | Static, frozen forever | Static, 1 h |

Local timings (`next start`, warm):

```text
/                  x-nextjs-cache: HIT    ~5 ms
/products/<slug>   x-nextjs-cache: HIT    ~8 ms   (was SSR + DB)
/brands            x-nextjs-cache: HIT    ~8 ms
/shop              dynamic               ~25 ms  (first hit 169 ms, then data-cache hits)
/shop/<category>   dynamic               ~30 ms
/brands/<brand>    dynamic               ~22 ms
```

Images:

```text
GET /api/media/file/demo-12.jpg
  Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable

GET /_next/image?url=…&w=640&q=80     (Accept: image/avif)
  Content-Type: image/avif
  Cache-Control: public, max-age=31536000, must-revalidate
  9,862 bytes  (source JPEG was 65,374 bytes — 85% smaller)
```

Correctness was verified end to end: renaming a product in the admin makes the
prerendered product page and the homepage show the new title on the next request,
with no rebuild (`x-nextjs-cache: MISS` on the write, `HIT` afterwards).

## 3. The caching model (read this before adding a query)

There are two caches and they are invalidated by the same tags.

```text
Payload admin save
        │
        │  afterChange / afterDelete hook
        ▼
revalidateTag('products' | 'brands' | 'categories' | 'global_header' | …)
revalidatePath('/' | '/shop' | '/products/<slug>' | …)
        │
        ├──▶ data cache  : unstable_cache(...) entries tagged with the same strings
        └──▶ route cache : the prerendered HTML of every route that used those tags
```

### 3.1 Tags

All tag names live in [`src/utilities/cacheTags.ts`](../src/utilities/cacheTags.ts).
Never write a tag as a string literal in a query — the hooks and the cache must
agree, and a typo silently produces a page that never refreshes.

### 3.2 Adding a cached read

```ts
export const getCachedThing = unstable_cache(
  async (arg: string) => {
    const payload = await getPayload({ config })   // never pass `payload` in
    return payload.find({ … })
  },
  ['storefront-thing'],                            // key prefix
  { revalidate: 3600, tags: [CACHE_TAGS.products] },
)
```

Rules:

1. **Build the Payload instance inside** the cached function. A `Payload` class
   instance is not a cache key and not serializable.
2. **Declare every tag** the result depends on.
3. **`revalidate` is a safety net**, not the invalidation strategy. Prefer a tag
   plus a hook.
4. **Draft mode is handled for you.** Next skips `unstable_cache` entirely while
   draft mode is on, so previews always read live data. A query that must serve
   *both* a published and a draft shape (product detail pages) should branch on
   `draftMode().isEnabled` and only take the cached path when it is false.
5. **Never cache per-user data** (orders, addresses, rewards balance).

### 3.3 Adding a new collection

Use the factories in
[`src/hooks/revalidateStorefront.ts`](../src/hooks/revalidateStorefront.ts):

```ts
hooks: {
  afterChange: [thingRevalidate.afterChange],
  afterDelete: [thingRevalidate.afterDelete],
}
```

A slug-addressed collection gets `createSlugRevalidateHooks`, a global gets
`createGlobalRevalidateHook`. The factories already handle renames (the old slug
is revalidated too) and wrap the calls in a guard so a CLI script or a seed —
where Next has no request scope — can still write without throwing.

### 3.4 Why `revalidate` appeared on previously frozen pages

`getCachedGlobal` declares `revalidate: 3600`. Because the root layout reads a
global, that value propagates to every route rendering the layout. That is
intentional: pages used to be cached until the next deploy, which meant a palette
or footer change required a rebuild. They now self-heal within the hour and are
invalidated immediately on save.

## 4. Images

| Lever | Value | Why |
| --- | --- | --- |
| `images.minimumCacheTTL` | 31 days | Next's default is 60 s. Payload filenames are timestamped, so every upload URL is immutable. |
| `images.formats` | `avif`, `webp` | AVIF was 85% smaller than the source JPEG for a 640 px product tile. |
| `Media` component `quality` | 80 (overridable) | Was hard-coded to 90 for every image on the site. |
| `/api/media/file/:path*` | `public, max-age=31536000, s-maxage=31536000, immutable` | Lets Vercel's edge hold the binary instead of invoking a function that first queries the database. |
| `R2_PUBLIC_URL` | optional | When set, `generateFileURL` emits absolute CDN URLs, so `next/image` fetches from R2 rather than from the app. |
| `Media/Image` | server component | It used to be `'use client'` purely to hold a `useState` whose value was never read, which pulled every product tile on every page into the client bundle. |

The `R2_PUBLIC_URL` path is opt-in: leave it unset and media keeps being served
from `/api/media/file/…` exactly as before.

## 5. What is still worth doing (not in this change)

1. **Co-locate the database with the functions.** Vercel runs in `cdg1` (Paris);
   if the Postgres host is in another region, every *uncached* query pays that
   distance. Caching hides it, but the account, order and checkout routes are
   uncacheable by nature and will always pay it.
2. **Use a pooled connection string** (Neon `-pooler`, Supabase pooler,
   PgBouncer). Serverless functions multiply connections; connection
   establishment is the most expensive part of a cold query.
3. **Set `R2_PUBLIC_URL`** so the product photography no longer flows through the
   application at all — and so a database outage cannot take the images down
   with it.
4. **A `/sitemap.ts` and corrected `robots.ts`** so the prerendered catalogue is
   discoverable.
5. **`/api/proxy-video` does not forward `Range`**, so seeking in proxied videos
   is unreliable and each seek re-downloads from the start.
