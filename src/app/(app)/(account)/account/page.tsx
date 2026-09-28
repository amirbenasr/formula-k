import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { AccountForm } from '@/components/forms/AccountForm'
import { OrderItem } from '@/components/OrderItem'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Order } from '@/payload-types'

export default async function AccountPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Connectez-vous pour accéder à votre compte.')}`)
  }

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      limit: 5,
      user,
      overrideAccess: false,
      pagination: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    orders = ordersResult?.docs || []
  } catch {
    // Building before the API/database is reachable must not break the page.
  }

  const hasOrders = Boolean(orders && orders.length > 0)

  return (
    <>
      <section className="surface surface-pad">
        <h1 className="mb-6 font-serif text-2xl font-medium text-foreground sm:text-3xl">
          Mes informations
        </h1>
        <AccountForm />
      </section>

      <section className="surface surface-pad">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-medium text-foreground">
            Mes dernières commandes
          </h2>
          <Button asChild className="w-full sm:w-auto" size="sm" variant="outline">
            <Link href="/orders">Toutes mes commandes</Link>
          </Button>
        </div>

        {!hasOrders ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-muted">
              Vous n’avez pas encore passé de commande. Vos futures commandes apparaîtront ici.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/shop">Découvrir la boutique</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {orders?.map((order) => (
              <li className="rounded-xl border border-border p-4" key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Gérez vos informations, vos adresses et vos commandes Formula K.',
  openGraph: mergeOpenGraph({
    title: 'Mon compte',
    url: '/account',
  }),
  title: 'Mon compte',
}
