import type { Metadata } from 'next'

import { OrderItem } from '@/components/OrderItem'
import { Button } from '@/components/ui/button'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Order } from '@/payload-types'

export default async function Orders() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Connectez-vous pour voir vos commandes.')}`)
  }

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      limit: 0,
      pagination: false,
      user,
      overrideAccess: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    orders = ordersResult?.docs || []
  } catch {
    // Building before the database is reachable must not break the page.
  }

  const hasOrders = Boolean(orders && orders.length > 0)

  return (
    <section className="surface surface-pad">
      <h1 className="mb-6 font-serif text-2xl font-medium text-foreground sm:text-3xl">
        Mes commandes
      </h1>

      {!hasOrders ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted">
            Aucune commande pour le moment. Vos commandes apparaîtront ici dès votre premier achat.
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
  )
}

export const metadata: Metadata = {
  description: 'Historique de vos commandes Formula K.',
  openGraph: mergeOpenGraph({
    title: 'Mes commandes',
    url: '/orders',
  }),
  title: 'Mes commandes',
}
