import React, { Suspense } from 'react'

import { Categories } from './Categories'
import { FilterList } from './filter'
import { sortingFr } from './sortOptions'

type Props = {
  children: React.ReactNode
  /** The sort control is hidden on pages that do not sort (e.g. the brand directory). */
  showSort?: boolean
}

/**
 * Shared catalogue shell for `/shop`, `/shop/[slug]` and `/brands/[slug]`.
 * Every listing page renders the exact same sidebar and the exact same content
 * column width, so a product tile is always the same size.
 */
export function CatalogLayout({ children, showSort = true }: Props) {
  return (
    <Suspense fallback={null}>
      <div className="container my-10 pb-4 sm:my-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          {/* Content first on mobile so the page H1 leads; sidebar first from md up. */}
          <div className="w-full min-w-0 md:order-2 md:flex-1">{children}</div>

          <aside className="w-full md:order-1 md:w-56 md:shrink-0 lg:w-64">
            <div className="surface surface-pad flex flex-col gap-6">
              <Categories />
              {showSort ? <FilterList list={sortingFr} title="Trier par" /> : null}
            </div>
          </aside>
        </div>
      </div>
    </Suspense>
  )
}
