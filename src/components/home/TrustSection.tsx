import { BadgeCheck, CreditCard, RefreshCcw, Truck } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { SectionHeading } from './SectionHeading'

const reasons = [
  {
    icon: CreditCard,
    title: 'Paiement à la livraison',
    text: 'Aucun paiement en ligne. Vous réglez en espèces au livreur, une fois le colis en main.',
  },
  {
    icon: Truck,
    title: 'Livraison 24–48h',
    text: 'Expédition le jour même pour toute commande passée avant 15h, partout en Tunisie.',
  },
  {
    icon: BadgeCheck,
    title: 'Produits authentiques',
    text: 'Uniquement des marques coréennes originales, conservées et expédiées dans de bonnes conditions.',
  },
  {
    icon: RefreshCcw,
    title: 'Échange sous 7 jours',
    text: 'Un produit qui ne convient pas ? Contactez-nous et on trouve une solution rapidement.',
  },
]

/** Removes the main COD objections for first-time Tunisian buyers. */
export function TrustSection() {
  return (
    <section className="py-10 lg:py-14">
      <div className="container">
        <SectionHeading
          align="center"
          eyebrow="Pourquoi Formula K"
          title="Commander en toute confiance"
          subtitle="Pas de carte bancaire, pas de risque : vous payez seulement quand votre commande arrive."
          className="mb-8"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="flex h-full flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <reason.icon className="h-5 w-5" />
              </span>
              <h3 className="font-serif text-lg font-semibold text-foreground">{reason.title}</h3>
              <p className="text-[13px] leading-relaxed text-muted">{reason.text}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Déjà commandé ?{' '}
          <Link href="/find-order" className="font-medium text-primary hover:underline">
            Suivez votre commande
          </Link>
        </p>
      </div>
    </section>
  )
}
