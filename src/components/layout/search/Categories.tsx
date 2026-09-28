import configPromise from '@payload-config'
import clsx from 'clsx'
import { getPayload } from 'payload'
import { Suspense } from 'react'

import { AllProductsLink, CategoryItem } from './Categories.client'

/** Single source of truth for the catalogue navigation — every category is listed. */
async function CategoryList() {
  const payload = await getPayload({ config: configPromise })

  const categories = await payload.find({
    collection: 'categories',
    sort: 'title',
    pagination: false,
    limit: 200,
  })

  return (
    <nav aria-label="Catégories">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Catégories
      </h2>

      <ul className="flex flex-col">
        <li>
          <AllProductsLink />
        </li>
        {categories.docs.map((category) => {
          return (
            <li key={category.id}>
              <CategoryItem category={category} />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const skeleton = 'mb-3 h-4 w-5/6 animate-pulse rounded'
const activeAndTitles = 'bg-foreground dark:bg-foreground'
const items = 'bg-muted/50 dark:bg-muted'

export function Categories() {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="w-full flex-none">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <CategoryList />
    </Suspense>
  )
}
