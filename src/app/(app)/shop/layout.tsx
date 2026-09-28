import { CatalogLayout } from '@/components/layout/search/CatalogLayout'
import React from 'react'

/**
 * The sidebar (all categories + sort) and the content column live in the shared
 * catalogue shell so `/shop` and `/shop/[slug]` can never drift apart.
 * The body search field was removed: the header search is the single search entry.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <CatalogLayout>{children}</CatalogLayout>
}
