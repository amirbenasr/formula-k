import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import { cn } from '@/utilities/cn'
import React from 'react'

import { SectionHeading } from './SectionHeading'

type Props = {
  products: ProductCardProduct[]
  /** True when the order came from real sales data (shows the ranking badges) */
  ranked?: boolean
}

/** Olive Young style ranked best-seller grid. */
export function BestSellers({ products, ranked = false }: Props) {
  if (products.length === 0) return null

  return (
    <section className="py-10 lg:py-14">
      <div className="container">
        <SectionHeading
          eyebrow={ranked ? 'Top ventes' : 'Coups de cœur'}
          title={ranked ? 'Les meilleures ventes' : 'Nos incontournables'}
          subtitle={
            ranked
              ? 'Les produits que nos clientes commandent le plus souvent en Tunisie.'
              : 'La sélection de l’équipe : les essentiels pour démarrer une routine K-Beauty.'
          }
          href="/shop"
          linkLabel="Toute la boutique"
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {products.slice(0, 8).map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              rank={ranked ? index + 1 : undefined}
              imageSizes="(min-width: 1024px) 23vw, 45vw"
            />
          ))}
        </div>

        {ranked ? (
          <p className={cn('mt-4 text-center text-xs text-muted')}>
            Classement établi à partir des commandes réellement passées sur Formula K.
          </p>
        ) : null}
      </div>
    </section>
  )
}
