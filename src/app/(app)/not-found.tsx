import { Button } from '@/components/ui/button'
import { Home, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

export default function NotFound() {
  return (
    <div className="container flex items-center justify-center py-16 sm:py-24">
      <div className="surface surface-pad mx-auto flex w-full max-w-xl flex-col items-center gap-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Erreur 404
        </p>

        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          Page introuvable
        </h1>

        <p className="text-sm leading-relaxed text-muted">
          La page que vous cherchez n&apos;existe plus ou a été déplacée. Revenez à l&apos;accueil
          ou poursuivez votre routine depuis la boutique.
        </p>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild className="w-full sm:w-auto" size="lg">
            <Link href="/shop">
              <ShoppingBag />
              Voir la boutique
            </Link>
          </Button>

          <Button asChild className="w-full sm:w-auto" size="lg" variant="outline">
            <Link href="/">
              <Home />
              Retour à l&apos;accueil
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <Link
            className="inline-flex min-h-6 items-center text-muted transition-colors hover:text-primary-ink"
            href="/brands"
          >
            Nos marques
          </Link>
          <span aria-hidden="true" className="text-border">
            •
          </span>
          <Link
            className="inline-flex min-h-6 items-center text-muted transition-colors hover:text-primary-ink"
            href="/find-order"
          >
            Suivre ma commande
          </Link>
        </div>
      </div>
    </div>
  )
}
