import { ArrowRight, Gift } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

/** Closing call to action: shop or join the loyalty program. */
export function CtaBand() {
  return (
    <section className="py-4 lg:py-6">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary px-6 py-10 text-center text-white lg:px-16 lg:py-14">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 right-0 h-52 w-52 rounded-full bg-accent/30 blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <Gift className="h-3.5 w-3.5" />
              Glow Rewards
            </span>

            <h2 className="mt-4 font-serif text-2xl font-bold leading-tight lg:text-4xl">
              Prête à révéler votre glow ?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm text-white/90 lg:text-base">
              Chaque commande vous rapporte des points, échangeables contre des produits et des
              remises. Livraison 24–48h, paiement à la réception.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-pill bg-white px-6 py-3 text-sm font-semibold text-primary transition hover:bg-white/90"
              >
                Commencer mes achats
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/rewards"
                className="inline-flex items-center justify-center rounded-pill border-2 border-white/80 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Découvrir Glow Rewards
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
