import type { Metadata } from 'next'

import { RewardsDashboard } from '@/components/rewards/RewardsDashboard'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

export default async function AccountRewardsPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  // The dashboard fetches /api/rewards/balance, which answers 401 for a guest;
  // without this gate the page rendered a spinner with no explanation.
  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Connectez-vous pour accéder à vos points Glow Rewards.')}`,
    )
  }

  return (
    <section>
      <h1 className="mb-6 font-serif text-2xl font-medium text-foreground sm:text-3xl">
        Mes points Glow Rewards
      </h1>
      <RewardsDashboard />
    </section>
  )
}

export const metadata: Metadata = {
  description:
    'Consultez votre solde de points, échangez vos récompenses et suivez votre progression.',
  openGraph: mergeOpenGraph({
    title: 'Mes points Glow Rewards',
    url: '/account/rewards',
  }),
  title: 'Mes points Glow Rewards',
}
