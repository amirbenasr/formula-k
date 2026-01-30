'use client'

import { useState } from 'react'
import { CMSLink } from '@/components/Link'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import Link from 'next/link'
import React, { Suspense } from 'react'
import { Search, ShoppingBag, Menu, Heart, User } from 'lucide-react'

import { MobileNav } from './MobileNav'
import type { Header } from 'src/payload-types'

import { LogoIcon } from '@/components/icons/logo'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'
import { useAuth } from '@/providers/Auth'

type Props = {
  header: Header
}

export function HeaderClient({ header }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menu = header.navItems || []
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-card/95 dark:bg-background/95 backdrop-blur-sm border-b border-border">
      {/* Announcement Bar */}
      <div className="bg-primary/10 py-2 text-center">
        <p className="text-sm text-primary-800 dark:text-primary-200">
          Free shipping on orders over <span className="font-medium">$99</span>
        </p>
      </div>

      <div className="container">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 -ml-2 text-muted hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="w-8 h-auto" />
            <span className="text-2xl lg:text-3xl font-serif font-bold text-primary hidden sm:inline">
              Formula K
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {menu.map((item) => (
              <CMSLink
                key={item.id}
                {...item.link}
                className={cn(
                  'text-sm font-medium text-muted hover:text-primary transition-colors',
                  {
                    'text-primary':
                      item.link.url && item.link.url !== '/'
                        ? pathname.includes(item.link.url)
                        : false,
                  }
                )}
                appearance="inline"
              />
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Search */}
            <button
              className="p-2 text-muted hover:text-foreground transition-colors"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Account */}
            <Link
              href={user ? '/account' : '/login'}
              className="hidden lg:flex p-2 text-muted hover:text-foreground transition-colors"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="hidden lg:flex p-2 text-muted hover:text-foreground transition-colors"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
            </Link>

            {/* Cart */}
            <Suspense fallback={<OpenCartButton />}>
              <Cart />
            </Suspense>
          </div>
        </div>

        {/* Search Bar */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            searchOpen ? 'max-h-20 pb-4' : 'max-h-0'
          )}
        >
          <div className="relative">
            <input
              type="search"
              placeholder="Search products..."
              className="w-full rounded-pill border border-border pl-12 pr-4 py-3 text-sm bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        menu={menu}
      />
    </header>
  )
}
