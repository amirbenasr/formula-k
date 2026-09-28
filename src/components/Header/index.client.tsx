'use client'

import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { CMSLink } from '@/components/Link'
import { LogoIcon } from '@/components/icons/logo'
import { RewardsHeaderWidget } from '@/components/rewards/RewardsHeaderWidget'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { ChevronDown, CreditCard, LayoutGrid, Menu, Search, Sparkles, Truck, User, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { Suspense, useEffect, useState } from 'react'
import type { Header } from 'src/payload-types'

import { MobileNav } from './MobileNav'
import { SearchBox } from './SearchBox'

export type HeaderCategory = {
  id: number | string
  title: string
  slug: string
  productCount?: number
}

type Props = {
  header: Header
  categories: HeaderCategory[]
}

export function HeaderClient({ header, categories }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const menu = header.navItems || []
  const pathname = usePathname()
  const { user } = useAuth()

  // Close transient header UI on navigation.
  useEffect(() => {
    setCategoriesOpen(false)
    setSearchOpen(false)
  }, [pathname])

  // Typing "s" anywhere is a habit for shoppers; keep the shortcut out of inputs.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const featuredCategories = categories.slice(0, 6)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      {/* Announcement bar — the three facts Tunisian COD shoppers look for */}
      <div className="bg-primary text-white">
        <div className="container flex items-center justify-center gap-x-5 overflow-x-auto py-2 text-[11px] font-medium [scrollbar-width:none] sm:gap-x-6 sm:text-xs [&::-webkit-scrollbar]:hidden">
          <span className="flex shrink-0 items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            <span className="sm:hidden">Livraison 24–48h</span>
            <span className="hidden sm:inline">Livraison 24–48h partout en Tunisie</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            <span className="sm:hidden">Paiement à la livraison</span>
            <span className="hidden sm:inline">Paiement à la livraison</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            Livraison offerte dès 199 TND
          </span>
        </div>
      </div>

      <div className="container">
        <div className="flex h-16 items-center gap-3 lg:h-[68px] lg:gap-6">
          {/* Mobile menu */}
          <button
            className="-ml-2 cursor-pointer p-2 text-foreground transition-colors lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <LogoIcon className="h-8 w-auto" />
            <span className="hidden font-serif text-2xl font-bold text-primary sm:inline lg:text-[26px]">
              Formula K
            </span>
          </Link>

          {/* Search — always visible on desktop, that is where discovery happens */}
          <div className="hidden max-w-xl flex-1 lg:block">
            <SearchBox />
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 lg:gap-2">
            <RewardsHeaderWidget />

            {/* Mobile search toggle */}
            <button
              className="cursor-pointer p-2 text-muted transition-colors hover:text-foreground lg:hidden"
              onClick={() => setSearchOpen((value) => !value)}
              aria-label="Rechercher"
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>

            <Link
              href={user ? '/account' : '/login'}
              className="hidden cursor-pointer p-2 text-muted transition-colors hover:text-foreground lg:flex"
              aria-label={user ? 'Mon compte' : 'Se connecter'}
            >
              <User className="h-5 w-5" />
            </Link>

            <Suspense fallback={<OpenCartButton />}>
              <Cart />
            </Suspense>
          </div>
        </div>

        {/* Mobile search panel */}
        {searchOpen ? (
          <div className="pb-3 lg:hidden">
            <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
          </div>
        ) : null}

        {/* Desktop catalog navigation */}
        <nav className="hidden items-center justify-between border-t border-border/70 lg:flex">
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoriesOpen((value) => !value)}
                onMouseEnter={() => setCategoriesOpen(true)}
                aria-expanded={categoriesOpen}
                className="flex cursor-pointer items-center gap-2 py-3 pr-3 text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                <LayoutGrid className="h-4 w-4" />
                Toutes les catégories
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', categoriesOpen && 'rotate-180')}
                />
              </button>

              {categoriesOpen && categories.length > 0 ? (
                <div
                  onMouseLeave={() => setCategoriesOpen(false)}
                  className="absolute left-0 top-full z-50 w-[520px] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-hover"
                >
                  <div className="grid grid-cols-2 gap-1">
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/shop/${category.slug}`}
                        onClick={() => setCategoriesOpen(false)}
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-secondary/40 hover:text-primary"
                      >
                        <span className="truncate">{category.title}</span>
                        {category.productCount ? (
                          <span className="shrink-0 text-[11px] text-muted">
                            {category.productCount}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>

                  <Link
                    href="/shop"
                    onClick={() => setCategoriesOpen(false)}
                    className="mt-1 block rounded-xl bg-secondary/30 px-3 py-2 text-center text-[13px] font-medium text-primary hover:underline"
                  >
                    Voir toute la boutique
                  </Link>
                </div>
              ) : null}
            </div>

            {featuredCategories.map((category) => (
              <Link
                key={category.id}
                href={`/shop/${category.slug}`}
                className={cn(
                  'px-2.5 py-3 text-sm text-muted transition-colors hover:text-primary',
                  pathname === `/shop/${category.slug}` && 'font-medium text-primary',
                )}
              >
                {category.title}
              </Link>
            ))}

            <Link
              href="/shop?sort=-createdAt"
              className="px-2.5 py-3 text-sm text-muted transition-colors hover:text-primary"
            >
              Nouveautés
            </Link>
          </div>

          <div className="flex items-center gap-1">
            {menu.map((item) => (
              <CMSLink
                key={item.id}
                {...item.link}
                className={cn(
                  'px-2.5 py-3 text-[13px] font-medium text-muted transition-colors hover:text-primary',
                  {
                    'text-primary':
                      item.link.url && item.link.url !== '/'
                        ? pathname.includes(item.link.url)
                        : false,
                  },
                )}
                appearance="inline"
              />
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        menu={menu}
        categories={categories}
      />
    </header>
  )
}
