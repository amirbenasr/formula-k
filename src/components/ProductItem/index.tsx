import { Media } from '@/components/Media'
import { Price } from '@/components/Price'
import { Product, Variant } from '@/payload-types'
import Link from 'next/link'
import React from 'react'

type Props = {
  product: Product
  variant?: Variant
  quantity?: number
  /**
   * Force all formatting to a particular currency.
   */
  currencyCode?: string
  /**
   * Optional extra content rendered under the product line (used by the cart).
   */
  children?: React.ReactNode
}

/**
 * One purchased product line: thumbnail, title, selected options, quantity and
 * line subtotal. Used by the order detail and confirmation views.
 */
export const ProductItem: React.FC<Props> = ({ product, quantity, variant, currencyCode }) => {
  const { title } = product

  const metaImage =
    product.meta?.image && typeof product.meta?.image !== 'string' ? product.meta.image : undefined

  const firstGalleryImage =
    typeof product.gallery?.[0]?.image !== 'string' ? product.gallery?.[0]?.image : undefined

  let image = firstGalleryImage || metaImage

  const isVariant = Boolean(variant) && typeof variant === 'object'

  if (isVariant) {
    const imageVariant = product.gallery?.find((item) => {
      if (!item.variantOption) return false
      const variantOptionID =
        typeof item.variantOption === 'object' ? item.variantOption.id : item.variantOption

      return variant?.options?.some((option) => {
        if (typeof option === 'object') return option.id === variantOptionID
        return option === variantOptionID
      })
    })

    if (imageVariant && typeof imageVariant.image !== 'string') {
      image = imageVariant.image
    }
  }

  const itemPrice = variant?.priceInUSD || product.priceInUSD
  const itemURL = `/products/${product.slug}${variant ? `?variant=${variant.id}` : ''}`

  return (
    <div className="flex items-start gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/30 p-1.5">
        <div className="relative h-full w-full">
          {image && typeof image !== 'string' ? (
            <Media className="" fill imgClassName="rounded-lg object-cover" resource={image} />
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 grow items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-base leading-snug font-medium text-foreground">
            <Link
              className="inline-flex min-h-6 items-center hover:text-primary-ink"
              href={itemURL}
            >
              {title}
            </Link>
          </p>

          {variant ? (
            <p className="text-sm text-muted">
              {variant.options
                ?.map((option) => (typeof option === 'object' ? option.label : null))
                .filter(Boolean)
                .join(', ')}
            </p>
          ) : null}

          {quantity ? <p className="text-sm text-muted">Quantité : {quantity}</p> : null}
        </div>

        {itemPrice && quantity ? (
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
              Sous-total
            </p>
            <Price amount={itemPrice * quantity} currencyCode={currencyCode} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
