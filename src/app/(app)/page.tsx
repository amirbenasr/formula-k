import { BestSellers } from '@/components/home/BestSellers'
import { BrandStrip } from '@/components/home/BrandStrip'
import { CategoryCircles } from '@/components/home/CategoryCircles'
import { CtaBand } from '@/components/home/CtaBand'
import { Hero } from '@/components/home/Hero'
import { NewArrivals } from '@/components/home/NewArrivals'
import { TrustBar } from '@/components/home/TrustBar'
import { TrustSection } from '@/components/home/TrustSection'
import { VideoShowcase } from '@/components/VideoShowcase'
import config from '@payload-config'
import { getPayload } from 'payload'

import { getBestSellers, getCategoryShowcase, getFreshProducts } from '@/utilities/storefront'

export const metadata = {
  title: 'Formula K | K-Beauty en Tunisie — livraison 24-48h, paiement à la livraison',
  description:
    'Sérums, crèmes, masques et solaires des meilleures marques coréennes, livrés partout en Tunisie en 24–48h. Paiement à la livraison, produits 100% authentiques.',
}

export default async function HomePage() {
  const payload = await getPayload({ config })

  // One round of queries, run in parallel: the storefront must feel instant.
  const [freshProducts, bestSellers, categoryShowcase, brandsResult, videoProductsResult] =
    await Promise.all([
      getFreshProducts(payload, 12),
      getBestSellers(payload, 8),
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
        limit: 12,
        where: {
          and: [{ _status: { equals: 'published' } }, { featuredInVideoShowcase: { equals: true } }],
        },
      }),
    ])

  const videoShowcaseProducts = videoProductsResult.docs.filter(
    (product) => product.videos && product.videos.length > 0,
  )

  // When there is no sales history yet, showcase the newest buyable products
  // instead of inventing a ranking.
  const hasSalesData = bestSellers.length > 0
  const showcaseProducts = hasSalesData ? bestSellers : freshProducts.slice(0, 8)

  return (
    <div>
      <Hero products={freshProducts} />
      <TrustBar />

      <BestSellers products={showcaseProducts} ranked={hasSalesData} />

      <CategoryCircles categories={categoryShowcase} />

      {videoShowcaseProducts.length > 0 ? (
        <VideoShowcase products={videoShowcaseProducts} />
      ) : null}

      <NewArrivals products={freshProducts} />

      <BrandStrip brands={brandsResult.docs} />

      <TrustSection />

      <CtaBand />
    </div>
  )
}
