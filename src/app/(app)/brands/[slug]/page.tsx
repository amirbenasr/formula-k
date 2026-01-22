import { Grid } from '@/components/Grid'
import { ProductGridItem } from '@/components/ProductGridItem'
import { Media } from '@/components/Media'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Media as MediaType } from '@/payload-types'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'brands',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const brand = docs[0]

  if (!brand) {
    return { title: 'Brand Not Found' }
  }

  return {
    title: `${brand.title} | SouGlowy`,
    description: brand.description || `Shop ${brand.title} products at SouGlowy`,
  }
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const { docs: brands } = await payload.find({
    collection: 'brands',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const brand = brands[0]

  if (!brand) {
    notFound()
  }

  const logo = brand.logo as MediaType | null

  const { docs: products } = await payload.find({
    collection: 'products',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { brand: { equals: brand.id } },
      ],
    },
    select: {
      title: true,
      slug: true,
      gallery: true,
      priceInUSD: true,
    },
    sort: 'title',
  })

  return (
    <div>
      {/* Brand Hero Section */}
      <section className="bg-gradient-to-b from-secondary/30 to-background">
        <div className="container py-12 lg:py-16">
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
            {logo?.url && (
              <div className="relative w-24 h-24 lg:w-32 lg:h-32 mb-6">
                <Media
                  resource={logo}
                  className="object-contain"
                  imgClassName="object-contain"
                />
              </div>
            )}
            <h1 className="text-3xl lg:text-5xl font-serif font-bold text-foreground mb-4">
              {brand.title}
            </h1>
            {brand.description && (
              <p className="text-muted text-lg leading-relaxed">
                {brand.description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl lg:text-2xl font-serif font-semibold">
            Tous les Produits
          </h2>
          <span className="text-sm text-muted">
            {products.length} {products.length === 1 ? 'produit' : 'produits'}
          </span>
        </div>

        {products.length > 0 ? (
          <Grid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductGridItem key={product.id} product={product} />
            ))}
          </Grid>
        ) : (
          <div className="text-center py-16 bg-secondary/20 rounded-soft">
            <p className="text-muted">
              Aucun produit disponible pour cette marque.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
