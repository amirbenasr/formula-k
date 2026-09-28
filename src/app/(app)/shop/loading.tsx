import { ProductGrid } from '@/components/ProductCard/ProductGrid'
import React from 'react'

/** Skeleton tiles shaped like the real product cards. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-56 animate-pulse rounded-full bg-secondary/60" />
        <div className="h-4 w-24 animate-pulse rounded-full bg-secondary/60" />
      </div>

      <ProductGrid>
        {Array(8)
          .fill(0)
          .map((_, index) => {
            return (
              <div className="surface animate-pulse overflow-hidden" key={index} aria-hidden="true">
                <div className="aspect-square bg-secondary/40" />
                <div className="flex flex-col gap-2 p-3.5 sm:p-4">
                  <div className="h-3 w-1/3 rounded-full bg-secondary/60" />
                  <div className="h-3 w-5/6 rounded-full bg-secondary/60" />
                  <div className="h-4 w-16 rounded-full bg-secondary/60" />
                </div>
              </div>
            )
          })}
      </ProductGrid>
    </div>
  )
}
