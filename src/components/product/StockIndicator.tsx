'use client'
import { Product, Variant } from '@/payload-types'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

type Props = {
  product: Product
}

/** Stable empty array so the fallback below keeps a constant identity. */
const NO_VARIANTS: (number | Variant)[] = []

export const StockIndicator: React.FC<Props> = ({ product }) => {
  const searchParams = useSearchParams()

  const variants = product.variants?.docs || NO_VARIANTS

  const selectedVariant = useMemo<Variant | undefined>(() => {
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')
      const validVariant = variants.find((variant) => {
        if (typeof variant === 'object') {
          return String(variant.id) === variantId
        }
        return String(variant) === variantId
      })

      if (validVariant && typeof validVariant === 'object') {
        return validVariant
      }
    }

    return undefined
  }, [product.enableVariants, searchParams, variants])

  const stockQuantity = useMemo(() => {
    if (product.enableVariants) {
      if (selectedVariant) {
        return selectedVariant.inventory || 0
      }
    }
    return product.inventory || 0
  }, [product.enableVariants, selectedVariant, product.inventory])

  if (product.enableVariants && !selectedVariant) {
    return null
  }

  return (
    <div className="text-sm font-medium">
      {stockQuantity < 5 && stockQuantity > 0 ? (
        <p className="text-error">Plus que {stockQuantity} en stock — commandez vite</p>
      ) : null}
      {stockQuantity >= 5 ? <p className="text-accent">En stock, expédié sous 24h</p> : null}
      {(stockQuantity === 0 || !stockQuantity) && <p className="text-muted">Rupture de stock</p>}
    </div>
  )
}
