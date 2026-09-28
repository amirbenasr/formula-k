import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth/AuthShell'
import { FindOrderForm } from '@/components/forms/FindOrderForm'
import configPromise from '@payload-config'
import { PackageSearch } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

export default async function FindOrderPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <AuthShell
      description="Renseignez l’e-mail utilisé lors de la commande et son numéro pour suivre votre colis."
      icon={PackageSearch}
      title="Suivre ma commande"
    >
      <FindOrderForm initialEmail={user?.email} />
    </AuthShell>
  )
}

export const metadata: Metadata = {
  description: 'Suivez votre commande Formula K avec votre e-mail et votre numéro de commande.',
  openGraph: {
    title: 'Suivre ma commande',
    url: '/find-order',
  },
  title: 'Suivre ma commande',
}
