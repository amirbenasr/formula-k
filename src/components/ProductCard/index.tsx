import { Media } from '@/components/Media'
import { Price } from '@/components/Price'
import type { Media as MediaType, Product, Variant } from '@/payload-types'
import { cn } from '@/utilities/cn'
import { Flame, Sparkles } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { QuickAdd } from './QuickAdd'

export type ProductCardProduct = Pick<
  Product,
  | 'id'
  | 'title'
  | 'slug'
  | 'brand'
  | 'gallery'
  | 'priceInUSD'
  | 'inventory'
  | 'enableVariants'
  | 'createdAt'
> & {
  variants?: Product['variants']
}

type Props = {
  product: ProductCardProduct
  /** Rank shown as a badge (bestseller style: 1, 2, 3…) */
  rank?: number
  /** Renders a lighter card suited to dense rails */
  variant?: 'default' | 'compact'
  /** next/image `sizes` hint for the grid the card lives in */
  imageSizes?: string
  priority?: boolean
  className?: string
}

const LOW_STOCK_THRESHOLD = 4
const NEW_WINDOW_DAYS = 21

function toMedia(value: Product['gallery'] | null | undefined): MediaType | undefined {
  const image = value?.[0]?.image
  return image && typeof image === 'object' ? image : undefined
}

function toHoverMedia(value: Product['gallery'] | null | undefined): MediaType | undefined {
  const image = value?.[1]?.image
  return image && typeof image === 'object' ? image : undefined
}

/**
 * Product tile used on the homepage, category rails and search results.
 * Server component; the only client island is the quick-add button.
 */
export function ProductCard({
  product,
  rank,
  variant = 'default',
  imageSizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  priority,
  className,
}: Props) {
  const { title, slug, inventory, priceInUSD, enableVariants } = product

  // Brand is a required relationship on products; render its name as a small kicker.
  const brandName =
    product.brand && typeof product.brand === 'object' ? product.brand.title : undefined

  const image = toMedia(product.gallery)
  const hoverImage = toHoverMedia(product.gallery)

  const variants = product.variants?.docs?.filter(
    (item): item is Variant => typeof item === 'object',
  )
  const firstVariant = variants?.[0]
  const hasVariants = Boolean(enableVariants && variants?.length)

  // Same precedence as the cart: variant price wins when variants are enabled.
  const price = hasVariants && firstVariant?.priceInUSD ? firstVariant.priceInUSD : priceInUSD

  const soldOut = inventory === 0
  const lowStock =
    typeof inventory === 'number' && inventory > 0 && inventory <= LOW_STOCK_THRESHOLD

  // Server component: compute directly, no hooks.
  const isNew = product.createdAt
    ? Date.now() - new Date(product.createdAt).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
    : false

  const href = `/products/${slug}`
  const compact = variant === 'compact'

  return (
    <div
      className={cn(
        'group/card relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-hover',
        className,
      )}
    >
      <Link
        href={href}
        className="relative block aspect-square overflow-hidden bg-[#faf6f5]"
        aria-label={title}
        tabIndex={-1}
      >
        {image ? (
          <Media
            resource={image}
            fill
            size={imageSizes}
            priority={priority}
            imgClassName={cn(
              'object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.05]',
              soldOut && 'opacity-60 saturate-50',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary/40 text-xs text-muted">
            Photo à venir
          </div>
        )}

        {/* Second gallery image on hover — cheap "more angles" cue */}
        {hoverImage && !soldOut ? (
          <Media
            resource={hoverImage}
            fill
            size={imageSizes}
            imgClassName="absolute inset-0 object-cover opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
          />
        ) : null}

        {/* Bestseller rank (Olive Young style) */}
        {typeof rank === 'number' ? (
          <span
            className={cn(
              'absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-soft',
              rank <= 3 ? 'bg-primary text-white' : 'bg-card/95 text-foreground',
            )}
            aria-label={`N°${rank} des ventes`}
          >
            {rank}
          </span>
        ) : null}

        {/* Freshness badge */}
        {isNew && !soldOut && typeof rank !== 'number' ? (
          <span className="badge-new absolute right-2.5 top-2.5 gap-1 bg-card/95 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-soft">
            <Sparkles className="h-3 w-3" />
            Nouveau
          </span>
        ) : null}

        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="rounded-pill bg-foreground/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Rupture de stock
            </span>
          </div>
        ) : null}
      </Link>

      <div
        className={cn(
          'flex flex-1 flex-col gap-1.5',
          compact ? 'p-3' : 'p-3.5 sm:p-4',
        )}
      >
        {brandName ? (
          <Link
            href={href}
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors group-hover/card:text-primary"
          >
            {brandName}
          </Link>
        ) : null}

        <Link href={href} className="block">
          <h3
            className={cn(
              'line-clamp-2 font-medium leading-snug text-foreground transition-colors group-hover/card:text-primary',
              compact ? 'text-[13px]' : 'text-sm',
            )}
          >
            {title}
          </h3>
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="flex flex-col gap-0.5">
            {typeof price === 'number' ? (
              <Price
                amount={price}
                className={cn(
                  'font-semibold tracking-tight text-foreground',
                  compact ? 'text-sm' : 'text-base',
                )}
              />
            ) : (
              <span className="text-sm text-muted">Prix à venir</span>
            )}

            {lowStock ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-error">
                <Flame className="h-3 w-3" />
                Plus que {inventory} en stock
              </span>
            ) : null}
          </div>

          <QuickAdd
            productId={product.id}
            title={title}
            soldOut={soldOut}
            requiresVariant={hasVariants}
            className={compact ? 'h-8 w-8' : undefined}
          />
        </div>
      </div>
    </div>
  )
}
