import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { RewardsLandingPage } from '@/components/rewards/RewardsLandingPage'

export default function RewardsPage() {
  return <RewardsLandingPage />
}

export const metadata: Metadata = {
  title: 'Glow Rewards - Earn Points & Unlock Benefits',
  description:
    'Join our rewards program and earn points with every purchase. Unlock exclusive benefits, free products, and achieve your skincare goals.',
  openGraph: mergeOpenGraph({
    title: 'Glow Rewards - Earn Points & Unlock Benefits',
    url: '/rewards',
  }),
}
