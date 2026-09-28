import type { CategoryWithPreview } from '@/utilities/storefront'
import { Droplet } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { SectionHeading } from './SectionHeading'

type Props = {
  categories: CategoryWithPreview[]
}

/** YesStyle style round category shortcuts, driven by the real categories collection. */
export function CategoryCircles({ categories }: Props) {
  if (categories.length === 0) return null

  return (
    <section className="bg-secondary/25 py-10 dark:bg-card/40 lg:py-14">
      <div className="container">
        <SectionHeading
          eyebrow="Votre routine"
          title="Achetez par catégorie"
          subtitle="Du double nettoyage à la protection solaire : construisez votre routine étape par étape."
          href="/shop"
        />

        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              href={`/shop/${category.slug}`}
              className="group flex flex-col items-center gap-2.5 text-center"
            >
              <span className="relative aspect-square w-full max-w-[116px] overflow-hidden rounded-full border border-border/70 bg-card transition duration-300 group-hover:border-primary/40 group-hover:shadow-hover">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt={category.imageAlt ?? category.title}
                    fill
                    sizes="120px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-primary/50">
                    <Droplet className="h-7 w-7" />
                  </span>
                )}
              </span>

              <span className="text-[13px] font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
                {category.title}
              </span>

              {category.productCount > 0 ? (
                <span className="-mt-1.5 text-[11px] text-muted">
                  {category.productCount} produit{category.productCount > 1 ? 's' : ''}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
