import type { Brand } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { SectionHeading } from './SectionHeading'

type Props = {
  brands: Brand[]
}

/**
 * Brand credibility strip.
 *
 * The brand `logo` field is not guaranteed to hold a real wordmark (a product
 * photo or a white-on-cream mark renders as an invisible sliver), so the band
 * always renders the brand *name* as a legible bordered chip on an even grid
 * that fills the width.
 */
export function BrandStrip({ brands }: Props) {
  if (brands.length === 0) return null

  return (
    <section className="border-y border-border bg-card/60 py-10 lg:py-14">
      <div className="container">
        <SectionHeading
          align="center"
          eyebrow="Marques"
          title="Nos marques coréennes"
          subtitle="Les maisons coréennes que nous sélectionnons pour votre routine."
          className="mb-8"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {brands.slice(0, 12).map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className="flex min-h-11 items-center justify-center rounded-2xl border border-border bg-card px-3 py-3 text-center font-serif text-sm font-medium leading-snug text-foreground shadow-soft transition duration-200 hover:border-primary/40 hover:text-primary-ink lg:text-base"
            >
              {brand.title}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/brands">
              Toutes les marques
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
