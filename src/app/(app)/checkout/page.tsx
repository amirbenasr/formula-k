import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { CheckoutPage } from '@/components/checkout/CheckoutPage'

export default function Checkout() {
  return (
    <div className="container py-8 lg:py-12">
      <CheckoutPage />
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Finalisez votre commande — paiement à la livraison partout en Tunisie.',
  openGraph: mergeOpenGraph({
    title: 'Finaliser ma commande',
    url: '/checkout',
  }),
  title: 'Finaliser ma commande',
}
