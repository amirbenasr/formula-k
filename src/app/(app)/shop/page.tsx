import { Grid } from '@/components/Grid'
import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import { searchProductCatalog } from '@/utilities/storefront'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

export const metadata = {
  description: 'Search for products in the store.',
  title: 'Shop',
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

export default async function ShopPage({ searchParams }: Props) {
  const { q: searchValue, sort, category } = await searchParams
  const payload = await getPayload({ config: configPromise })

  const products = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      brand: true,
      gallery: true,
      categories: true,
      priceInUSD: true,
      inventory: true,
      enableVariants: true,
      variants: true,
      createdAt: true,
    },
    ...(sort ? { sort } : { sort: 'title' }),
    ...(searchValue || category
      ? {
          where: {
            and: [
              {
                _status: {
                  equals: 'published',
                },
              },
              ...(searchValue
                ? [
                    {
                      // `description` is richText (jsonb): `like` on it is invalid
                      // SQL on Postgres and made every search fail silently.
                      or: [
                        {
                          title: {
                            like: searchValue,
                          },
                        },
                        {
                          'brand.title': {
                            like: searchValue,
                          },
                        },
                      ],
                    },
                  ]
                : []),
              ...(category
                ? [
                    {
                      categories: {
                        contains: category,
                      },
                    },
                  ]
                : []),
            ],
          },
        }
      : {}),
  })

  // `like` in Postgres is accent-sensitive, so "creme" never matched "Crème".
  // Fall back to the normalised catalogue search when the SQL query finds nothing.
  let docs = products.docs as ProductCardProduct[]

  const searchQuery = Array.isArray(searchValue) ? searchValue[0] : searchValue

  if (searchQuery && docs.length === 0) {
    const fallback = await searchProductCatalog(payload, searchQuery, 60)
    const sortBy = Array.isArray(sort) ? sort[0] : sort

    if (sortBy) {
      const direction = sortBy.startsWith('-') ? -1 : 1
      const field = sortBy.replace(/^-/, '')

      fallback.sort((a, b) => {
        if (field === 'priceInUSD') return ((a.priceInUSD ?? 0) - (b.priceInUSD ?? 0)) * direction
        if (field === 'createdAt') {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return (aTime - bTime) * direction
        }
        return a.title.localeCompare(b.title, 'fr') * direction
      })
    }

    docs = fallback
  }

  const resultsText = docs.length > 1 ? 'resultats' : 'resultat'

  return (
    <div>
      {searchValue ? (
        <p className="mb-4 text-sm text-muted">
          {docs.length === 0
            ? 'Aucun produit ne correspond à '
            : `${docs.length} ${resultsText} pour `}
          <span className="font-semibold text-foreground">&quot;{searchValue}&quot;</span>
        </p>
      ) : null}

      {!searchValue && docs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <p className="text-muted">Aucun produit disponible pour le moment.</p>
        </div>
      )}

      {docs.length > 0 ? (
        <Grid className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {docs.map((product) => {
            return <ProductCard key={product.id} product={product} imageSizes="(min-width: 1024px) 23vw, 45vw" />
          })}
        </Grid>
      ) : null}
    </div>
  )
}
