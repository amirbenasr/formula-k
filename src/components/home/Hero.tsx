import { ProductCard, type ProductCardProduct } from '@/components/ProductCard'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  products: ProductCardProduct[]
}

/**
 * Product-first hero: the shop's actual catalogue is visible in the first
 * viewport, next to a short pitch and the primary calls to action.
 *
 * Reassurance lives in the single <TrustBar /> band right below the hero — the
 * hero itself does not repeat the same claims.
 */
export function Hero({ products }: Props) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-background to-accent/10">
      {/* soft decorative light */}
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />

      <div className="container relative py-6 lg:py-12">
        {/* On mobile the tiles are ordered before the CTAs so real products appear
            in the first viewport; on lg the layout collapses back into two columns. */}
        <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="contents lg:col-span-4 lg:block">
            <span className="badge-new order-1 mb-0 self-start lg:mb-4">
              K-Beauty livrée en Tunisie
            </span>

            <h1 className="order-2 font-serif text-[26px] font-bold leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
              Votre glow coréen, livré chez vous
            </h1>

            <p className="order-3 max-w-lg text-[13px] leading-relaxed text-muted sm:text-base lg:mt-4">
              Sérums, crèmes, masques et protections solaires des plus grandes marques coréennes.
              Commandez en 1 minute, payez à la réception.
            </p>

            <div className="order-5 mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:mt-6">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/shop">
                  Découvrir la boutique
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/shop?sort=-createdAt">Nouveautés</Link>
              </Button>
            </div>
          </div>

          <div className="order-4 lg:order-none lg:col-span-8">
            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {products.slice(0, 4).map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 2}
                    imageSizes="(min-width: 1024px) 20vw, 45vw"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-card/60 p-8 text-center">
                <Sparkles className="h-8 w-8 text-primary-ink" />
                <p className="font-serif text-xl font-semibold">Catalogue en préparation</p>
                <p className="max-w-sm text-sm text-muted">
                  Vos produits apparaîtront ici automatiquement dès qu&apos;ils seront publiés dans
                  l&apos;admin Payload.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
