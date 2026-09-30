import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import { ProductPagination } from '@/components/ProductCard/Pagination'
import { ProductGrid } from '@/components/ProductCard/ProductGrid'
import { getCachedCatalogProducts } from '@/utilities/catalog'
import { searchProductCatalog } from '@/utilities/storefront'
import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  description:
    'Tous les soins coréens Formula K : sérums, crèmes, nettoyants, essences, solaires. Livraison 24-48h partout en Tunisie, paiement à la livraison.',
  title: 'Tous les produits | Formula K',
}

/** Products per page — three full rows of the 4-column grid. */
const PAGE_SIZE = 12

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

/** Search params can repeat; the storefront only ever uses the first value. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams
  const searchValue = first(params.q)
  const sort = first(params.sort)
  const category = first(params.category)

  const requestedPage = Number.parseInt(first(params.page) ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

  // Cached per filter combination: this route is dynamic because it reads
  // `searchParams`, but it must not pay a database round trip on every hit.
  const products = await getCachedCatalogProducts({
    page,
    pageSize: PAGE_SIZE,
    sort,
    search: searchValue,
    categoryID: category,
  })

  let docs = products.docs as ProductCardProduct[]
  let totalDocs = products.totalDocs
  let currentPage = page

  // `like` in Postgres is accent-sensitive, so "creme" never matched "Crème".
  // Fall back to the normalised catalogue search when the SQL query finds nothing.
  if (searchValue && products.docs.length === 0 && page === 1) {
    const fallback = await searchProductCatalog(searchValue, 60)

    if (sort) {
      const direction = sort.startsWith('-') ? -1 : 1
      const field = sort.replace(/^-/, '')

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

    totalDocs = fallback.length
    docs = fallback.slice(0, PAGE_SIZE)
    currentPage = 1
  }

  const totalPages = Math.max(1, Math.ceil(totalDocs / PAGE_SIZE))
  const countLabel = `${totalDocs} ${totalDocs > 1 ? 'produits' : 'produit'}`

  const buildPageHref = (target: number) => {
    const next = new URLSearchParams()

    if (searchValue) next.set('q', searchValue)
    if (sort) next.set('sort', sort)
    if (category) next.set('category', category)
    if (target > 1) next.set('page', String(target))

    const query = next.toString()

    return query ? `/shop?${query}` : '/shop'
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          Tous les produits
        </h1>
        <p className="mt-2 text-sm text-muted">
          {searchValue ? `${countLabel} pour « ${searchValue} »` : countLabel}
        </p>
      </header>

      {totalDocs === 0 ? (
        <div className="surface surface-pad border-dashed text-center">
          <p className="text-muted">
            {searchValue
              ? 'Aucun produit ne correspond à cette recherche.'
              : 'Aucun produit disponible pour le moment.'}
          </p>
        </div>
      ) : (
        <>
          <ProductGrid>
            {docs.map((product) => {
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  imageSizes="(min-width: 1024px) 22vw, 45vw"
                />
              )
            })}
          </ProductGrid>

          <ProductPagination
            hrefForPage={buildPageHref}
            page={currentPage}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  )
}
