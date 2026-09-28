import { CreditCard, Headphones, ShieldCheck, Truck } from 'lucide-react'
import React from 'react'

const items = [
  {
    icon: Truck,
    title: 'Livraison 24–48h',
    detail: 'Partout en Tunisie',
  },
  {
    icon: CreditCard,
    title: 'Paiement à la livraison',
    detail: 'Vous payez en recevant',
  },
  {
    icon: ShieldCheck,
    title: '100% authentique',
    detail: 'Marques coréennes originales',
  },
  {
    icon: Headphones,
    title: 'Conseil personnalisé',
    detail: 'On vous guide dans la routine',
  },
]

/** Reassurance strip aimed at Tunisian COD shoppers — sits right under the hero. */
export function TrustBar() {
  return (
    <section className="border-y border-border bg-card/70">
      <div className="container grid grid-cols-2 gap-x-4 gap-y-4 py-4 lg:grid-cols-4 lg:py-5">
        {items.map((item) => (
          <div key={item.title} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold leading-tight text-foreground sm:text-[13px]">
                {item.title}
              </p>
              <p className="text-[11px] leading-tight text-muted sm:text-xs">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
