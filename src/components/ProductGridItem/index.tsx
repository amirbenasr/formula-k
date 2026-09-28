import type { Product } from '@/payload-types'

import Link from 'next/link'
import React from 'react'
import clsx from 'clsx'
import { Media } from '@/components/Media'
import { Price } from '@/components/Price'

type Props = {
  product: Partial<Product>
}

/**
 * Minimal product tile kept for backwards compatibility with the template.
 * Shares the single `surface` treatment used by every other listing tile.
 */
export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { gallery, priceInUSD, title, inventory } = product

  let price = priceInUSD

  const variants = product.variants?.docs

  if (variants && variants.length > 0) {
    const variant = variants[0]
    if (
      variant &&
      typeof variant === 'object' &&
      variant?.priceInUSD &&
      typeof variant.priceInUSD === 'number'
    ) {
      price = variant.priceInUSD
    }
  }

  const image =
    gallery?.[0]?.image && typeof gallery[0]?.image !== 'string' ? gallery[0]?.image : false

  const soldOut = inventory === 0

  return (
    <Link
      className="surface group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-hover"
      href={`/products/${product.slug}`}
    >
      <span className="relative block aspect-square overflow-hidden bg-secondary/40">
        {image ? (
          <Media
            fill
            imgClassName={clsx(
              'object-cover transition duration-300 ease-in-out group-hover:scale-105',
              {
                'opacity-60 saturate-50': soldOut,
              },
            )}
            resource={image}
            size="(min-width: 1024px) 22vw, 45vw"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-muted">
            Photo à venir
          </span>
        )}
      </span>

      <span className="flex items-center justify-between gap-2 p-3.5 sm:p-4">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary-ink">
          {title}
        </span>

        {typeof price === 'number' ? (
          <Price
            amount={price}
            className={clsx(
              'shrink-0 font-semibold tracking-tight',
              soldOut ? 'text-muted' : 'text-foreground',
            )}
          />
        ) : null}
      </span>
    </Link>
  )
}
