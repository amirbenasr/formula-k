import type { Metadata } from 'next'

import { AddressListing } from '@/components/addresses/AddressListing'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

export default async function AddressesPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Connectez-vous pour gérer vos adresses.')}`)
  }

  return (
    <section className="surface surface-pad">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          Mes adresses
        </h1>
        <CreateAddressModal className="w-full sm:w-auto" />
      </div>

      <AddressListing />
    </section>
  )
}

export const metadata: Metadata = {
  description: 'Gérez vos adresses de livraison Formula K.',
  openGraph: mergeOpenGraph({
    title: 'Mes adresses',
    url: '/account/addresses',
  }),
  title: 'Mes adresses',
}
