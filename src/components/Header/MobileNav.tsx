'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { ChevronRight, LayoutGrid, User, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import type { Header, Page, Product } from '@/payload-types'

import type { HeaderCategory } from './index.client'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  menu: Header['navItems']
  categories?: HeaderCategory[]
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

export function MobileNav({ isOpen, onClose, menu, categories = [] }: MobileNavProps) {
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
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Slide-out Menu */}
      <div
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[85%] max-w-sm transform flex-col bg-card transition-transform duration-300 ease-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-serif text-xl font-bold text-primary-ink">Formula K</span>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 text-muted transition-colors hover:text-foreground"
            aria-label="Fermer le menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {/* Shop links — the fastest route to a product */}
          <div className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Boutique
          </div>

          <Link
            href="/shop"
            className="flex items-center gap-3 px-6 py-3 text-foreground transition-colors hover:bg-secondary/50"
            onClick={onClose}
          >
            <LayoutGrid className="h-5 w-5 text-primary-ink" />
            <span className="font-medium">Tous les produits</span>
          </Link>

          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop/${category.slug}`}
              className="flex items-center justify-between px-6 py-3 text-foreground transition-colors hover:bg-secondary/50"
              onClick={onClose}
            >
              <span className="font-medium">{category.title}</span>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
          ))}

          <Link
            href="/shop?sort=-createdAt"
            className="flex items-center justify-between px-6 py-3 text-foreground transition-colors hover:bg-secondary/50"
            onClick={onClose}
          >
            <span className="font-medium">Nouveautés</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>

          {menu && menu.length > 0 ? (
            <>
              <div className="px-6 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Navigation
              </div>
              {menu.map((item) => (
                <Link
                  key={item.id}
                  href={getLinkHref(item.link)}
                  className="flex items-center justify-between px-6 py-3 text-foreground transition-colors hover:bg-secondary/50"
                  onClick={onClose}
                >
                  <span className="font-medium">{item.link.label}</span>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Link>
              ))}
            </>
          ) : null}

          {/* Divider */}
          <div className="mx-6 my-3 border-t border-border" />

          <Link
            href={user ? '/account' : '/login'}
            className="flex items-center gap-3 px-6 py-3 text-muted transition-colors hover:text-foreground"
            onClick={onClose}
          >
            <User className="h-5 w-5" />
            <span>{user ? 'Mon compte' : 'Se connecter'}</span>
          </Link>
        </nav>

        {/* Account Section */}
        <div className="mt-auto bg-secondary/30 p-6 dark:bg-secondary/10">
          {user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">Connectée en tant que</p>
              <p className="font-medium text-foreground">{user.email}</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/account" onClick={onClose}>
                    Compte
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/logout" onClick={onClose}>
                    Déconnexion
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Connectez-vous pour suivre vos commandes</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login" onClick={onClose}>
                    Connexion
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/create-account" onClick={onClose}>
                    Créer un compte
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
