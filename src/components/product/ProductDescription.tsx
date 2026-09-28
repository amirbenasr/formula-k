'use client'
import type { Category, Product, Variant } from '@/payload-types'

import { RichText } from '@/components/RichText'
import { Price } from '@/components/Price'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { BadgeCheck, CreditCard, Truck } from 'lucide-react'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { BuyPanel } from './BuyPanel'
import { VariantSelector } from './VariantSelector'
import { useCurrency } from '@payloadcms/plugin-ecommerce/client/react'
import { StockIndicator } from '@/components/product/StockIndicator'

/** The site's own shipping/payment claims — nothing product-specific is invented. */
const reassurance = [
  { icon: Truck, title: 'Livraison 24-48h', detail: 'Partout en Tunisie' },
  { icon: CreditCard, title: 'Paiement à la livraison', detail: 'Vous payez en recevant' },
  { icon: BadgeCheck, title: 'Livraison offerte', detail: 'Dès 199 TND' },
]

export function ProductDescription({ product }: { product: Product }) {
  const { currency } = useCurrency()
  let amount = 0,
    lowestAmount = 0,
    highestAmount = 0
  const priceField = `priceIn${currency.code}` as keyof Product
  const hasVariants = product.enableVariants && Boolean(product.variants?.docs?.length)

  if (hasVariants) {
    const priceField = `priceIn${currency.code}` as keyof Variant
    const variantsOrderedByPrice = product.variants?.docs
      ?.filter((variant) => variant && typeof variant === 'object')
      .sort((a, b) => {
        if (
          typeof a === 'object' &&
          typeof b === 'object' &&
          priceField in a &&
          priceField in b &&
          typeof a[priceField] === 'number' &&
          typeof b[priceField] === 'number'
        ) {
          return a[priceField] - b[priceField]
        }

        return 0
      }) as Variant[]

    const lowestVariant = variantsOrderedByPrice[0][priceField]
    const highestVariant = variantsOrderedByPrice[variantsOrderedByPrice.length - 1][priceField]
    if (
      variantsOrderedByPrice &&
      typeof lowestVariant === 'number' &&
      typeof highestVariant === 'number'
    ) {
      lowestAmount = lowestVariant
      highestAmount = highestVariant
    }
  } else if (product[priceField] && typeof product[priceField] === 'number') {
    amount = product[priceField]
  }

  const brand = typeof product.brand === 'object' && product.brand ? product.brand : undefined

  const categories = (product.categories ?? []).filter(
    (category): category is Category => typeof category === 'object' && category !== null,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {brand ? (
          <Link
            href={`/brands/${brand.slug}`}
            className="inline-flex min-h-6 w-fit items-center text-[11px] font-semibold tracking-[0.18em] text-muted uppercase transition-colors hover:text-primary-ink"
          >
            {brand.title}
          </Link>
        ) : null}

        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          {product.title}
        </h1>

        <div className="text-xl font-semibold tracking-tight text-foreground">
          {hasVariants ? (
            <Price highestAmount={highestAmount} lowestAmount={lowestAmount} />
          ) : (
            <Price amount={amount} />
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <StockIndicator product={product} />
      </Suspense>

      {hasVariants ? (
        <Suspense fallback={null}>
          <VariantSelector product={product} />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <BuyPanel product={product} />
      </Suspense>

      {/* Same reassurance treatment as the site-wide trust strip. */}
      <ul className="grid gap-3 rounded-2xl border border-border bg-secondary/30 p-4 sm:grid-cols-3 sm:gap-4">
        {reassurance.map((item) => (
          <li className="flex items-center gap-2.5" key={item.title}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
              <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold leading-tight text-foreground">
                {item.title}
              </span>
              <span className="block text-[11px] leading-tight text-muted">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {product.description ? (
        <RichText className="text-sm" data={product.description} enableGutter={false} />
      ) : null}

      <Accordion className="surface surface-pad" collapsible type="single">
        <AccordionItem value="livraison">
          <AccordionTrigger className="font-medium text-foreground">
            Livraison &amp; paiement
          </AccordionTrigger>
          <AccordionContent className="text-muted">
            <p>
              Livraison 24-48h partout en Tunisie. Paiement à la livraison : vous payez en recevant
              votre commande.
            </p>
            <p className="mt-2">Livraison offerte dès 199 TND d&apos;achat.</p>
          </AccordionContent>
        </AccordionItem>

        {brand || categories.length ? (
          <AccordionItem value="details">
            <AccordionTrigger className="font-medium text-foreground">
              Détails du produit
            </AccordionTrigger>
            <AccordionContent>
              <dl className="flex flex-col gap-2 text-muted">
                {brand ? (
                  <div className="flex justify-between gap-4">
                    <dt>Marque</dt>
                    <dd className="font-medium text-foreground">{brand.title}</dd>
                  </div>
                ) : null}
                {categories.length ? (
                  <div className="flex justify-between gap-4">
                    <dt>Catégories</dt>
                    <dd className="text-right font-medium text-foreground">
                      {categories.map((category) => category.title).join(', ')}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </AccordionContent>
          </AccordionItem>
        ) : null}
      </Accordion>
    </div>
  )
}
