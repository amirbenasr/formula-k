import { cn } from '@/utilities/cn'
import { ShoppingCart } from 'lucide-react'
import React from 'react'

export function OpenCartButton({
  className,
  quantity,
  ...rest
}: {
  className?: string
  quantity?: number
}) {
  return (
    <button
      type="button"
      aria-label={quantity ? `Panier — ${quantity} article(s)` : 'Panier'}
      className={cn(
        'relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-primary',
        className,
      )}
      {...rest}
    >
      <ShoppingCart className="h-5 w-5" />

      {quantity ? (
        <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white">
          {quantity}
        </span>
      ) : null}
    </button>
  )
}
