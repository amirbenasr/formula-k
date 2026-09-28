'use client'

import { Button } from '@/components/ui/button'
import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Minus, Plus } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  product: Product
}

/** Stable empty array so the memo below keeps a constant identity. */
const NO_VARIANTS: (number | Variant)[] = []

/**
 * Primary buy control of the product page: quantity stepper + filled coral CTA,
 * so "Ajouter au panier" is the most prominent action on the page.
 * Same cart rules as the grid quick-add: variant selection and remaining stock.
 */
export function BuyPanel({ product }: Props) {
  const { addItem, isLoading } = useCart()
  const searchParams = useSearchParams()
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState(false)

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

  const available = useMemo(() => {
    if (product.enableVariants) return selectedVariant?.inventory ?? 0

    return product.inventory ?? 0
  }, [product.enableVariants, product.inventory, selectedVariant])

  const needsVariantChoice = Boolean(product.enableVariants && !selectedVariant)
  const soldOut = !needsVariantChoice && available <= 0
  const maxQuantity = Math.max(1, available)

  const addToCart = useCallback(
    async (event: React.FormEvent<HTMLButtonElement>) => {
      event.preventDefault()

      if (pending || soldOut || needsVariantChoice) return

      setPending(true)

      try {
        await addItem({ product: product.id, variant: selectedVariant?.id ?? undefined }, quantity)
        toast.success('Ajouté au panier', {
          description: quantity > 1 ? `${quantity} × ${product.title}` : product.title,
        })
        window.dispatchEvent(new CustomEvent('fk:open-cart'))
      } catch {
        toast.error("Impossible d'ajouter ce produit", {
          description: 'Réessayez dans un instant.',
        })
      } finally {
        setPending(false)
      }
    },
    [
      addItem,
      needsVariantChoice,
      pending,
      product.id,
      product.title,
      quantity,
      selectedVariant,
      soldOut,
    ],
  )

  const buttonLabel = soldOut
    ? 'Rupture de stock'
    : needsVariantChoice
      ? 'Choisissez une option'
      : 'Ajouter au panier'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex h-12 w-full items-center justify-between rounded-full border border-border bg-card px-1 sm:w-36">
        <button
          type="button"
          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          disabled={quantity <= 1 || soldOut}
          aria-label="Diminuer la quantité"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>

        <span
          aria-live="polite"
          className="min-w-6 text-center text-sm font-semibold text-foreground"
        >
          {quantity}
        </span>

        <button
          type="button"
          onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
          disabled={quantity >= maxQuantity || soldOut}
          aria-label="Augmenter la quantité"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Button
        className="w-full sm:w-auto"
        disabled={soldOut || needsVariantChoice || pending || isLoading}
        onClick={addToCart}
        size="lg"
        type="button"
      >
        {buttonLabel}
      </Button>
    </div>
  )
}
