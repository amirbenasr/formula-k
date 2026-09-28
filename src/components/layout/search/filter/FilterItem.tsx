'use client'

import type { SortFilterItem as SortFilterItemType } from '@/lib/constants'

import { createUrl } from '@/utilities/createUrl'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import React from 'react'

import type { ListItem } from '.'
import type { PathFilterItem as PathFilterItemType } from '.'

/**
 * Shared treatment for every sidebar entry: no underline, active item marked in
 * coral + medium weight (same convention as the header nav and the category list).
 */
const itemClassName = (active: boolean) =>
  clsx(
    'block w-full py-1.5 text-sm transition-colors',
    active ? 'font-medium text-primary-ink' : 'text-foreground/75 hover:text-primary-ink',
  )

function PathFilterItem({ item }: { item: PathFilterItemType }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = pathname === item.path
  const newParams = new URLSearchParams(searchParams.toString())

  newParams.delete('q')

  return (
    <li className="flex">
      <Link
        aria-current={active ? 'page' : undefined}
        className={itemClassName(active)}
        href={createUrl(item.path, newParams)}
      >
        {item.title}
      </Link>
    </li>
  )
}

function SortFilterItem({ item }: { item: SortFilterItemType }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sort = searchParams.get('sort')
  // A `null` slug is the default option, active whenever no sort is selected.
  const active = (item.slug ?? null) === sort
  const q = searchParams.get('q')
  const href = createUrl(
    pathname,
    new URLSearchParams({
      ...(q && { q }),
      ...(item.slug && item.slug.length && { sort: item.slug }),
    }),
  )

  return (
    <li className="flex">
      <Link
        aria-current={active ? 'page' : undefined}
        className={itemClassName(active)}
        href={href}
        prefetch={false}
      >
        {item.title}
      </Link>
    </li>
  )
}

export function FilterItem({ item }: { item: ListItem }) {
  return 'path' in item ? <PathFilterItem item={item} /> : <SortFilterItem item={item} />
}
