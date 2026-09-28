'use client'

import { cn } from '@/utilities/cn'
import { Gift, LayoutDashboard, LogOut, MapPin, Package } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

type Props = {
  className?: string
}

const items = [
  { href: '/account', label: 'Mes informations', Icon: LayoutDashboard },
  { href: '/account/addresses', label: 'Mes adresses', Icon: MapPin },
  { href: '/orders', label: 'Mes commandes', Icon: Package },
  { href: '/account/rewards', label: 'Glow Rewards', Icon: Gift },
]

const isActive = (pathname: string, href: string) =>
  href === '/account'
    ? pathname === '/account'
    : pathname === href || pathname.startsWith(`${href}/`)

/**
 * Account navigation. Previously desktop-only (`hidden md:flex` in the layout),
 * which left phone shoppers with no way to move between account sections, and it
 * was the last English block in the account area.
 */
export const AccountNav: React.FC<Props> = ({ className }) => {
  const pathname = usePathname()

  return (
    <div className={className}>
      {/* Mobile: horizontally scrollable pills */}
      <nav aria-label="Navigation du compte" className="md:hidden">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <li className="shrink-0" key={href}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors',
                    active
                      ? 'border-primary/50 bg-primary/10 font-medium text-primary-ink'
                      : 'border-border bg-card text-muted hover:text-foreground',
                  )}
                  href={href}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Desktop: vertical list */}
      <nav aria-label="Navigation du compte" className="hidden md:block">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <li key={href}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary-ink'
                      : 'text-muted hover:bg-secondary/50 hover:text-foreground',
                  )}
                  href={href}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="my-3 border-t border-border" />

        <Link
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-secondary/50 hover:text-foreground"
          href="/logout"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Link>
      </nav>
    </div>
  )
}
