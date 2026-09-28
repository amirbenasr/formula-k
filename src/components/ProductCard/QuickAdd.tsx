'use client'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Check, Loader2, Plus } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/utilities/cn'

type Props = {
  /** Product id (numeric for this project) */
  productId: number
  /** Product title, used in the confirmation toast */
  title: string
  /** Product uses variants — the shopper must pick one on the product page */
  requiresVariant?: boolean
  /** Out of stock — button is rendered disabled */
  soldOut?: boolean
  className?: string
}

/**
 * One-tap add to cart for product grids and rails.
 * Deliberately a small client island so product listings can stay server-rendered.
 */
export function QuickAdd({ productId, title, requiresVariant, soldOut, className }: Props) {
  const { addItem, isLoading } = useCart()
  const [pending, setPending] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const add = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      // The card itself is a link — never navigate when adding to the cart.
      event.preventDefault()
      event.stopPropagation()

      if (pending || justAdded || soldOut) return

      setPending(true)

      try {
        await addItem({ product: productId })
        setJustAdded(true)
        toast.success('Ajouté au panier', { description: title })
        window.dispatchEvent(new CustomEvent('fk:open-cart'))
        window.setTimeout(() => setJustAdded(false), 2500)
      } catch {
        toast.error("Impossible d'ajouter ce produit", { description: 'Réessayez dans un instant.' })
      } finally {
        setPending(false)
      }
    },
    [addItem, justAdded, pending, productId, soldOut, title],
  )

  const label = soldOut
    ? 'Rupture de stock'
    : requiresVariant
      ? 'Voir les options'
      : 'Ajouter au panier'

  return (
    <button
      type="button"
      onClick={add}
      disabled={soldOut || pending || isLoading}
      aria-label={soldOut ? `${title} — rupture de stock` : `Ajouter ${title} au panier`}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-200',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40',
        soldOut
          ? 'cursor-not-allowed border-border bg-secondary/40 text-muted'
          : justAdded
            ? 'border-success bg-success/20 text-foreground'
            : 'border-primary/25 bg-primary/10 text-primary hover:border-primary hover:bg-primary hover:text-white active:scale-95',
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : justAdded ? (
        <Check className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
    </button>
  )
}
