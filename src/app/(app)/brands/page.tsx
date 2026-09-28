import { Media } from '@/components/Media'
import type { Media as MediaType } from '@/payload-types'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

export const metadata: Metadata = {
  description:
    'Toutes les marques coréennes disponibles chez Formula K : Anua, COSRX, Beauty of Joseon, SKIN1004, Round Lab et plus encore.',
  title: 'Nos marques | Formula K',
}

/** Brand directory. The brand name is always written in text, logo or not. */
export default async function BrandsPage() {
  const payload = await getPayload({ config: configPromise })

  const { docs: brands, totalDocs } = await payload.find({
    collection: 'brands',
    sort: 'title',
    depth: 1,
    pagination: false,
    limit: 200,
  })

  return (
    <div className="container my-10 pb-4 sm:my-16">
      <div className="surface surface-pad">
        <header className="mb-6">
          <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
            Nos marques
          </h1>
          <p className="mt-2 text-sm text-muted">
            {totalDocs} {totalDocs > 1 ? 'marques' : 'marque'}
          </p>
        </header>

        {brands.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {brands.map((brand) => {
              const logo =
                brand.logo && typeof brand.logo === 'object' ? (brand.logo as MediaType) : undefined

              return (
                <Link
                  className="surface group flex flex-col items-center gap-3 p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-hover"
                  href={`/brands/${brand.slug}`}
                  key={brand.id}
                >
                  <span className="relative flex aspect-square w-full max-w-[128px] items-center justify-center overflow-hidden rounded-2xl bg-secondary/40">
                    {logo?.url ? (
                      <Media fill imgClassName="object-contain p-3" resource={logo} size="140px" />
                    ) : (
                      <span className="font-serif text-2xl font-medium text-muted">
                        {brand.title.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <span className="font-serif text-base font-medium leading-snug text-foreground transition-colors group-hover:text-primary-ink">
                    {brand.title}
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-muted">Aucune marque disponible pour le moment.</p>
        )}
      </div>
    </div>
  )
}
