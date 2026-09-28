import { Button } from '@/components/ui/button'
import { ArrowRight, Gift } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

/**
 * Closing call to action: shop or join the loyalty program.
 *
 * The band sits on a card surface (not a coral gradient) so the text reads at
 * full contrast, it stays clearly separate from the pink newsletter band in the
 * footer, and exactly one CTA — the filled coral button — is the primary action.
 */
export function CtaBand() {
  return (
    <section className="py-10 lg:py-14">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-10 text-center lg:px-16 lg:py-14">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 right-0 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-ink">
              <Gift className="h-3.5 w-3.5" />
              Glow Rewards
            </span>

            <h2 className="mt-4 font-serif text-2xl font-medium leading-tight text-foreground lg:text-4xl">
              Prête à révéler votre glow ?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm text-muted lg:text-base">
              Chaque commande vous rapporte des points, échangeables contre des produits et des
              remises. Livraison 24–48h, paiement à la réception.
            </p>

            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/shop">
                  Commencer mes achats
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/rewards">Découvrir Glow Rewards</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
