import { Media } from '@/components/Media'
import type { Brand } from '@/payload-types'
import Link from 'next/link'
import React from 'react'

type Props = {
  brands: Brand[]
}

/** Brand credibility strip — logo when the brand has one, wordmark otherwise. */
export function BrandStrip({ brands }: Props) {
  if (brands.length === 0) return null

  return (
    <section className="border-y border-border bg-card/60 py-8">
      <div className="container">
        <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Nos marques coréennes
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 lg:gap-x-14">
          {brands.slice(0, 12).map((brand) => {
            const logo = brand.logo && typeof brand.logo === 'object' ? brand.logo : undefined

            return (
              <Link
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="group flex items-center justify-center opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
                title={brand.title}
              >
                {logo?.url ? (
                  <Media
                    resource={logo}
                    htmlElement={null}
                    imgClassName="h-8 w-auto max-w-[132px] object-contain lg:h-10"
                    alt={logo.alt || brand.title}
                  />
                ) : (
                  <span className="font-serif text-lg font-semibold tracking-wide text-foreground transition-colors group-hover:text-primary lg:text-xl">
                    {brand.title}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
