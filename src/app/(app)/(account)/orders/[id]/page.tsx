import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { AddressItem } from '@/components/addresses/AddressItem'
import { OrderStatus } from '@/components/OrderStatus'
import { Price } from '@/components/Price'
import { ProductItem } from '@/components/ProductItem'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { ChevronLeftIcon } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string }>
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-1.5 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
    {children}
  </p>
)

export default async function Order({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '' } = await searchParams

  let order: Order | null = null

  try {
    const {
      docs: [orderResult],
    } = await payload.find({
      collection: 'orders',
      user,
      overrideAccess: !Boolean(user),
      depth: 2,
      where: {
        and: [
          {
            id: {
              equals: id,
            },
          },
          ...(user
            ? [
                {
                  customer: {
                    equals: user.id,
                  },
                },
              ]
            : []),
          ...(email
            ? [
                {
                  customerEmail: {
                    equals: email,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        amount: true,
        currency: true,
        items: true,
        customerEmail: true,
        customer: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        shippingAddress: true,
      },
    })

    const canAccessAsGuest =
      !user &&
      email &&
      orderResult &&
      orderResult.customerEmail &&
      orderResult.customerEmail === email
    const canAccessAsUser =
      user &&
      orderResult &&
      orderResult.customer &&
      (typeof orderResult.customer === 'object'
        ? orderResult.customer.id
        : orderResult.customer) === user.id

    if (orderResult && (canAccessAsGuest || canAccessAsUser)) {
      order = orderResult
    }
  } catch (error) {
    console.error(error)
  }

  if (!order) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title first so it stays left-aligned for guest order tracking too,
          where there is no "back" link to put on the left. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          Commande n°{order.id}
        </h1>

        {user ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/orders">
              <ChevronLeftIcon />
              Toutes mes commandes
            </Link>
          </Button>
        ) : null}
      </div>

      <section className="surface surface-pad flex flex-col gap-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Date de commande</Label>
            <p className="text-foreground">
              <time dateTime={order.createdAt}>
                {formatDateTime({ date: order.createdAt, format: 'dd/MM/yyyy' })}
              </time>
            </p>
          </div>

          <div>
            <Label>Total</Label>
            {order.amount ? <Price className="text-foreground" amount={order.amount} /> : null}
          </div>

          {order.status ? (
            <div>
              <Label>Statut</Label>
              <OrderStatus status={order.status} />
            </div>
          ) : null}
        </div>

        {order.items && order.items.length > 0 ? (
          <div>
            <h2 className="mb-4 font-serif text-xl font-medium text-foreground">Articles</h2>
            <ul className="flex flex-col gap-4">
              {order.items?.map((item, index) => {
                if (typeof item.product === 'string') {
                  return null
                }

                if (!item.product || typeof item.product !== 'object') {
                  return (
                    <li className="text-sm text-muted" key={index}>
                      Cet article n’est plus disponible.
                    </li>
                  )
                }

                const variant =
                  item.variant && typeof item.variant === 'object' ? item.variant : undefined

                return (
                  <li className="rounded-xl border border-border p-4" key={item.id}>
                    <ProductItem
                      product={item.product}
                      quantity={item.quantity}
                      variant={variant}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {order.shippingAddress ? (
          <div>
            <h2 className="mb-4 font-serif text-xl font-medium text-foreground">
              Adresse de livraison
            </h2>

            {/* @ts-expect-error - some kind of type hell */}
            <AddressItem address={order.shippingAddress} hideActions />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/shop">Continuer mes achats</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/find-order">Suivre une autre commande</Link>
        </Button>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return {
    description: `Détail de votre commande n°${id} chez Formula K.`,
    openGraph: mergeOpenGraph({
      title: `Commande n°${id}`,
      url: `/orders/${id}`,
    }),
    title: `Commande n°${id}`,
  }
}
