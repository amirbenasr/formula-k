import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { redirect } from 'next/navigation'

/**
 * Cash-on-delivery orders are created directly from /checkout, so there is no
 * payment step to confirm. This route only survives so old links keep working;
 * it sends the shopper straight back to the storefront.
 */
export default function ConfirmOrderPage() {
  redirect('/')
}

export const metadata: Metadata = {
  description: 'Redirection vers la boutique Formula K.',
  openGraph: mergeOpenGraph({
    title: 'Commande confirmée',
    url: '/checkout/confirm-order',
  }),
  title: 'Commande confirmée',
}
