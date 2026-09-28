import { BestSellers } from '@/components/home/BestSellers'
import { BrandStrip } from '@/components/home/BrandStrip'
import { CategoryCircles } from '@/components/home/CategoryCircles'
import { CtaBand } from '@/components/home/CtaBand'
import { Hero } from '@/components/home/Hero'
import { NewArrivals } from '@/components/home/NewArrivals'
import { TrustBar } from '@/components/home/TrustBar'
import type { ProductCardProduct } from '@/components/ProductCard'
import { VideoShowcase } from '@/components/VideoShowcase'
import config from '@payload-config'
import { getPayload } from 'payload'

import { getBestSellers, getCategoryShowcase, getFreshProducts } from '@/utilities/storefront'

export const metadata = {
  title: 'Formula K | K-Beauty en Tunisie — livraison 24-48h, paiement à la livraison',
  description:
    'Sérums, crèmes, masques et solaires des meilleures marques coréennes, livrés partout en Tunisie en 24–48h. Paiement à la livraison, produits 100% authentiques.',
}

/** How many products each rail would like to show. Shortfalls are fine, duplicates are not. */
const HERO_COUNT = 4
const BEST_SELLERS_COUNT = 8
const NEW_ARRIVALS_COUNT = 10
const VIDEO_COUNT = 12

/**
 * The hero, the best-sellers rail and the new-arrivals rail all draw from the
 * newest stock, so the catalogue is fetched once with enough headroom for every
 * rail to get its own slice.
 */
const CATALOGUE_FETCH = 24

export default async function HomePage() {
  const payload = await getPayload({ config })

  // One round of queries, run in parallel: the storefront must feel instant.
  const [freshProducts, salesHistory, categoryShowcase, brandsResult, videoProductsResult] =
    await Promise.all([
      getFreshProducts(payload, CATALOGUE_FETCH),
      getBestSellers(payload, BEST_SELLERS_COUNT),
      getCategoryShowcase(payload, 8),
      payload.find({
        collection: 'brands',
        overrideAccess: false,
        depth: 1,
        limit: 12,
        sort: 'title',
      }),
      payload.find({
        collection: 'products',
        draft: false,
        overrideAccess: false,
        depth: 2,
        limit: VIDEO_COUNT,
        where: {
          and: [
            { _status: { equals: 'published' } },
            { featuredInVideoShowcase: { equals: true } },
          ],
        },
      }),
    ])

  /**
   * Every section claims from the same id set, so a product can only ever be
   * rendered by the first rail that asks for it — never twice on the page.
   */
  const usedProductIDs = new Set<string>()

  function claim<T extends { id: number | string }>(products: T[], count: number): T[] {
    const claimed: T[] = []

    for (const product of products) {
      if (claimed.length >= count) break
      const id = String(product.id)
      if (usedProductIDs.has(id)) continue
      usedProductIDs.add(id)
      claimed.push(product)
    }

    return claimed
  }

  // 1. Hero — the newest products of the page own the first viewport.
  const heroProducts = claim(freshProducts, HERO_COUNT)

  // 2. Video showcase — a curated flag, minus anything the hero already shows.
  const videoCandidates = videoProductsResult.docs.filter(
    (product) => product.videos && product.videos.length > 0,
  )
  const videoShowcaseProducts = claim(videoCandidates, VIDEO_COUNT)

  // 3. Best sellers — ranked from real order history when the shop has sales.
  const rankedBestSellers = claim(salesHistory, BEST_SELLERS_COUNT)
  const hasSalesData = rankedBestSellers.length > 0

  // Without sales history the rail falls back to a merchandised selection that
  // is deliberately *not* the newest stock, so it can never mirror new arrivals.
  const bestSellerProducts = hasSalesData
    ? rankedBestSellers
    : claim(byEntryPrice(freshProducts), BEST_SELLERS_COUNT)

  // 4. New arrivals — the freshest stock that no other rail has claimed.
  const newArrivalProducts = claim(freshProducts, NEW_ARRIVALS_COUNT)

  return (
    <div>
      <Hero products={heroProducts} />
      <TrustBar />

      <BestSellers products={bestSellerProducts} ranked={hasSalesData} />

      <CategoryCircles categories={categoryShowcase} />

      {videoShowcaseProducts.length > 0 ? <VideoShowcase products={videoShowcaseProducts} /> : null}

      <NewArrivals products={newArrivalProducts} />

      <BrandStrip brands={brandsResult.docs} />

      <CtaBand />
    </div>
  )
}

/**
 * Merchandised fallback for the best-sellers rail on a shop with no order
 * history yet: the most accessible entry prices first. It is a different
 * selection from the newest-first arrivals rail by construction.
 */
function byEntryPrice(products: ProductCardProduct[]): ProductCardProduct[] {
  return [...products].sort(
    (a, b) =>
      (a.priceInUSD ?? Number.POSITIVE_INFINITY) - (b.priceInUSD ?? Number.POSITIVE_INFINITY),
  )
}
