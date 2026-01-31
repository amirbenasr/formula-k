import { Grid } from '@/components/Grid'
import { ProductGridItem } from '@/components/ProductGridItem'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const category = docs[0]

  if (!category) {
    return { title: 'Category Not Found' }
  }

  return {
    title: `${category.title} | SouGlowy`,
    description: `Shop ${category.title} products at SouGlowy`,
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q: searchValue, sort } = await searchParams
  const payload = await getPayload({ config: configPromise })

  const { docs: categories } = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const category = categories[0]

  if (!category) {
    notFound()
  }

  const products = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      gallery: true,
      categories: true,
      priceInUSD: true,
    },
    ...(sort ? { sort } : { sort: 'title' }),
    where: {
      and: [
        {
          _status: {
            equals: 'published',
          },
        },
        {
          categories: {
            contains: category.id,
          },
        },
        ...(searchValue
          ? [
              {
                or: [
                  {
                    title: {
                      like: searchValue,
                    },
                  },
                  {
                    description: {
                      like: searchValue,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    },
  })

  const resultsText = products.docs.length > 1 ? 'results' : 'result'

  return (
    <div>
      {/* Category Header */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground mb-2">
          {category.title}
        </h1>
        <span className="text-sm text-muted">
          {products.docs.length} {products.docs.length === 1 ? 'produit' : 'produits'}
        </span>
      </div>

      {searchValue ? (
        <p className="mb-4">
          {products.docs?.length === 0
            ? 'There are no products that match '
            : `Showing ${products.docs.length} ${resultsText} for `}
          <span className="font-bold">&quot;{searchValue}&quot;</span>
        </p>
      ) : null}

      {!searchValue && products.docs?.length === 0 && (
        <div className="text-center py-16 bg-secondary/20 rounded-soft">
          <p className="text-muted">Aucun produit disponible pour cette catégorie.</p>
        </div>
      )}

      {products?.docs.length > 0 ? (
        <Grid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.docs.map((product) => {
            return <ProductGridItem key={product.id} product={product} />
          })}
        </Grid>
      ) : null}
    </div>
  )
}
