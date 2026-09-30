import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import { ProductPagination } from '@/components/ProductCard/Pagination'
import { ProductGrid } from '@/components/ProductCard/ProductGrid'
import { getCachedCatalogProducts, getCachedCategoryBySlug } from '@/utilities/catalog'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** Products per page — three full rows of the 4-column grid. */
const PAGE_SIZE = 12

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await getCachedCategoryBySlug(slug)

  if (!category) {
    return { title: 'Catégorie introuvable | Formula K' }
  }

  return {
    title: `${category.title} | Formula K`,
    description: `Découvrez les produits ${category.title} chez Formula K, livrés partout en Tunisie.`,
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const search = await searchParams
  const searchValue = first(search.q)
  const sort = first(search.sort)

  const requestedPage = Number.parseInt(first(search.page) ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const category = await getCachedCategoryBySlug(slug)

  if (!category) {
    notFound()
  }

  const products = await getCachedCatalogProducts({
    page,
    pageSize: PAGE_SIZE,
    sort,
    search: searchValue,
    categoryID: category.id,
  })

  const totalDocs = products.totalDocs
  const totalPages = Math.max(1, Math.ceil(totalDocs / PAGE_SIZE))
  const countLabel = `${totalDocs} ${totalDocs > 1 ? 'produits' : 'produit'}`

  const buildPageHref = (target: number) => {
    const next = new URLSearchParams()

    if (searchValue) next.set('q', searchValue)
    if (sort) next.set('sort', sort)
    if (target > 1) next.set('page', String(target))

    const query = next.toString()

    return query ? `/shop/${slug}?${query}` : `/shop/${slug}`
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          {category.title}
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
              : 'Aucun produit disponible pour cette catégorie.'}
          </p>
        </div>
      ) : (
        <>
          <ProductGrid>
            {products.docs.map((product) => {
              return (
                <ProductCard
                  key={product.id}
                  product={product as ProductCardProduct}
                  imageSizes="(min-width: 1024px) 22vw, 45vw"
                />
              )
            })}
          </ProductGrid>

          <ProductPagination hrefForPage={buildPageHref} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
