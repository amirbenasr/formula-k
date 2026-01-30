'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X, ChevronRight, Heart, User } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { useAuth } from '@/providers/Auth'
import { Button } from '@/components/ui/button'
import type { Header, Page, Product } from '@/payload-types'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  menu: Header['navItems']
}

// Helper to get href from CMS link
function getLinkHref(link: {
  type?: 'custom' | 'reference' | null
  url?: string | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Product | string | number
  } | null
}): string {
  if (link.type === 'reference' && link.reference) {
    const { relationTo, value } = link.reference
    if (typeof value === 'object' && value.slug) {
      return relationTo !== 'pages' ? `/${relationTo}/${value.slug}` : `/${value.slug}`
    }
  }
  return link.url || '#'
}

export function MobileNav({ isOpen, onClose, menu }: MobileNavProps) {
  const { user } = useAuth()

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        onClose()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Slide-out Menu */}
      <div
        className={cn(
          'fixed top-0 left-0 h-full w-[85%] max-w-sm bg-card z-50 transform transition-transform duration-300 ease-out lg:hidden flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-xl font-serif font-bold text-primary">
            Formula K
          </span>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="py-4 flex-1 overflow-y-auto">
          {menu?.map((item) => (
            <Link
              key={item.id}
              href={getLinkHref(item.link)}
              className="flex items-center justify-between px-6 py-4 text-foreground hover:bg-secondary/50 transition-colors"
              onClick={onClose}
            >
              <span className="font-medium">{item.link.label}</span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="border-t border-border mx-6" />

        {/* Secondary Links */}
        <div className="py-4">
          <Link
            href="/wishlist"
            className="flex items-center gap-3 px-6 py-3 text-muted hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <Heart className="h-5 w-5" />
            <span>Wishlist</span>
          </Link>
          <Link
            href={user ? '/account' : '/login'}
            className="flex items-center gap-3 px-6 py-3 text-muted hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <User className="h-5 w-5" />
            <span>{user ? 'My Account' : 'Sign In'}</span>
          </Link>
        </div>

        {/* Account Section */}
        <div className="p-6 bg-secondary/30 dark:bg-secondary/10 mt-auto">
          {user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">Signed in as</p>
              <p className="font-medium text-foreground">{user.email}</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/account" onClick={onClose}>
                    Account
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/logout" onClick={onClose}>
                    Log out
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Sign in for the best experience</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login" onClick={onClose}>
                    Sign In
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/create-account" onClick={onClose}>
                    Register
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
