import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { RewardsDashboard } from '@/components/rewards/RewardsDashboard'

export default function AccountRewardsPage() {
  return (
    <div>
      <h1 className="text-3xl font-serif font-bold mb-8">My Rewards</h1>
      <RewardsDashboard />
    </div>
  )
}

export const metadata: Metadata = {
  title: 'My Rewards - Glow Rewards Dashboard',
  description: 'View your points balance, redeem rewards, and track your progress.',
  openGraph: mergeOpenGraph({
    title: 'My Rewards',
    url: '/account/rewards',
  }),
}
