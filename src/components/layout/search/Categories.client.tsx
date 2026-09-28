'use client'
import React, { useMemo } from 'react'

import { Category } from '@/payload-types'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import Link from 'next/link'

/**
 * One sidebar entry. The active state follows the header convention
 * (`text-primary-ink font-medium`) and nothing is underlined, so the category list
 * and the sort list read as the same kind of control.
 */
const itemClassName = (isActive: boolean) =>
  clsx(
    'block py-1.5 text-sm transition-colors',
    isActive ? 'font-medium text-primary-ink' : 'text-foreground/75 hover:text-primary-ink',
  )

type Props = {
  category: Category
}

export const CategoryItem: React.FC<Props> = ({ category }) => {
  const pathname = usePathname()

  const isActive = useMemo(() => {
    return pathname === `/shop/${category.slug}`
  }, [category.slug, pathname])

  return (
    <Link
      href={`/shop/${category.slug}`}
      aria-current={isActive ? 'page' : undefined}
      className={itemClassName(isActive)}
    >
      {category.title}
    </Link>
  )
}

/** Always rendered so `/shop` and `/shop/[slug]` show the exact same list. */
export const AllProductsLink: React.FC = () => {
  const pathname = usePathname()

  const isActive = pathname === '/shop'

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={itemClassName(isActive)}
      href="/shop"
    >
      Tous les produits
    </Link>
  )
}
