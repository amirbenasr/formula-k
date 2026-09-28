import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import React from 'react'

import { ProductRail } from './ProductRail'
import { SectionHeading } from './SectionHeading'

type Props = {
  products: ProductCardProduct[]
}

/** "Nouveautés" rail so returning visitors always see fresh stock. */
export function NewArrivals({ products }: Props) {
  if (products.length === 0) return null

  return (
    <section className="py-10 lg:py-14">
      <div className="container">
        <SectionHeading
          eyebrow="Nouveautés"
          title="Fraîchement arrivés"
          subtitle="Les dernières références ajoutées à la boutique."
          href="/shop?sort=-createdAt"
          className="lg:pr-24"
        />

        <ProductRail>
          {products.slice(0, 10).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="compact"
              imageSizes="(min-width: 1024px) 20vw, 60vw"
            />
          ))}
        </ProductRail>
      </div>
    </section>
  )
}
