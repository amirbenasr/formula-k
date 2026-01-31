'use client'
import React, { useMemo } from 'react'

import { Category } from '@/payload-types'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import Link from 'next/link'

type Props = {
  category: Category
}

export const CategoryItem: React.FC<Props> = ({ category }) => {
  const pathname = usePathname()

  const isActive = useMemo(() => {
    return pathname === `/shop/${category.slug}`
  }, [category.slug, pathname])

  const href = isActive ? '/shop' : `/shop/${category.slug}`

  return (
    <Link
      href={href}
      className={clsx('hover:cursor-pointer', {
        ' underline': isActive,
      })}
    >
      {category.title}
    </Link>
  )
}

export const AllProductsLink: React.FC = () => {
  const pathname = usePathname()

  const isOnCategoryPage = useMemo(() => {
    return pathname.startsWith('/shop/') && pathname !== '/shop'
  }, [pathname])

  if (!isOnCategoryPage) {
    return null
  }

  return (
    <Link href="/shop" className="hover:cursor-pointer text-muted hover:underline">
      Tous les Produits
    </Link>
  )
}
