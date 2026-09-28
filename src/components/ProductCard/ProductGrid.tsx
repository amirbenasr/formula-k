import { cn } from '@/utilities/cn'
import React from 'react'

/**
 * The one product grid definition used by every listing page
 * (`/shop`, `/shop/[slug]`, `/brands/[slug]`). 2 columns on phones,
 * 4 from `lg` up, with content-sized rows so a short last row never
 * stretches into an empty band.
 */
export const productGridClassName = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'

export function ProductGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(productGridClassName, className)}>{children}</div>
}
