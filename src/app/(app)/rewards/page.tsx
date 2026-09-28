import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { RewardsLandingPage } from '@/components/rewards/RewardsLandingPage'

export default function RewardsPage() {
  return <RewardsLandingPage />
}

export const metadata: Metadata = {
  title: 'Glow Rewards – Cumulez des points et débloquez des avantages',
  description:
    'Rejoignez notre programme de fidélité et gagnez des points à chaque commande. Débloquez des avantages exclusifs, des produits offerts et atteignez vos objectifs beauté.',
  openGraph: mergeOpenGraph({
    title: 'Glow Rewards – Cumulez des points et débloquez des avantages',
    url: '/rewards',
  }),
}
