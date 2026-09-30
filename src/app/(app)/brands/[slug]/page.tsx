import { CatalogLayout } from '@/components/layout/search/CatalogLayout'
import { Media } from '@/components/Media'
import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import { ProductPagination } from '@/components/ProductCard/Pagination'
import { ProductGrid } from '@/components/ProductCard/ProductGrid'
import type { Media as MediaType } from '@/payload-types'
import { getCachedBrandBySlug, getCachedCatalogProducts } from '@/utilities/catalog'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

/** Products per page — three full rows of the 4-column grid. */
const PAGE_SIZE = 12

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const brand = await getCachedBrandBySlug(slug)

  if (!brand) {
    return { title: 'Marque introuvable | Formula K' }
  }

  return {
    title: `${brand.title} | Formula K`,
    description:
      brand.description ||
      `Découvrez les produits ${brand.title} chez Formula K, livrés partout en Tunisie.`,
  }
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params
  const search = await searchParams
  const sort = first(search.sort)

  const requestedPage = Number.parseInt(first(search.page) ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const brand = await getCachedBrandBySlug(slug)

  if (!brand) {
    notFound()
  }

  const logo = brand.logo as MediaType | null

  const products = await getCachedCatalogProducts({
    page,
    pageSize: PAGE_SIZE,
    sort,
    brandID: brand.id,
  })

  const totalDocs = products.totalDocs
  const totalPages = Math.max(1, Math.ceil(totalDocs / PAGE_SIZE))
  const countLabel = `${totalDocs} ${totalDocs > 1 ? 'produits' : 'produit'}`

  const buildPageHref = (target: number) => {
    const next = new URLSearchParams()

    if (sort) next.set('sort', sort)
    if (target > 1) next.set('page', String(target))

    const query = next.toString()

    return query ? `/brands/${slug}?${query}` : `/brands/${slug}`
  }

  return (
    <CatalogLayout>
      <div className="flex flex-col gap-6">
        {/* Hero: the wordmark sits in its own column next to a framed logo,
            so the image can never overlap the heading. */}
        <section className="surface surface-pad">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border bg-secondary/40 sm:h-28 sm:w-28">
              {logo?.url ? (
                <Media fill imgClassName="object-contain p-2" resource={logo} size="112px" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-serif text-2xl font-medium text-muted">
                  {brand.title.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Marque
              </p>
              <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
                {brand.title}
              </h1>
              {brand.description ? (
                <p className="text-sm leading-relaxed text-muted">{brand.description}</p>
              ) : null}
              <p className="text-sm text-muted">{countLabel}</p>
            </div>
          </div>
        </section>

        {totalDocs > 0 ? (
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
        ) : (
          <div className="surface surface-pad border-dashed text-center">
            <p className="text-muted">Aucun produit disponible pour cette marque.</p>
          </div>
        )}
      </div>
    </CatalogLayout>
  )
}
