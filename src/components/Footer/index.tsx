import type { Footer } from '@/payload-types'

import { FooterMenu } from '@/components/Footer/menu'
import { LogoIcon } from '@/components/icons/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaletteSelector } from '@/providers/Palette/PaletteSelector'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { Banknote, Facebook, Instagram, MessageCircle, Sparkles, Truck } from 'lucide-react'
import Link from 'next/link'
import React, { Suspense } from 'react'

const { COMPANY_NAME, SITE_NAME, SMTP_FROM_ADDRESS } = process.env

/**
 * Only link to routes that exist. The template shipped links to /contact, /faq,
 * /shipping, /returns, /about, /privacy and /terms, none of which are
 * implemented — every one of them 404'd from every page of the site.
 */
const shopLinks = [
  { href: '/shop', label: 'Tous les produits' },
  { href: '/shop?sort=-createdAt', label: 'Nouveautés' },
  { href: '/brands', label: 'Nos marques' },
  { href: '/rewards', label: 'Glow Rewards' },
]

const accountLinks = [
  { href: '/account', label: 'Mon compte' },
  { href: '/orders', label: 'Mes commandes' },
  { href: '/account/addresses', label: 'Mes adresses' },
  { href: '/find-order', label: 'Suivre ma commande' },
]

const guarantees = [
  { icon: Truck, label: 'Livraison 24–48h partout en Tunisie' },
  { icon: Banknote, label: 'Paiement à la livraison' },
  { icon: Sparkles, label: 'Livraison offerte dès 199 TND' },
]

export async function Footer() {
  const footer: Footer = await getCachedGlobal('footer', 1)()
  const menu = footer.navItems || []
  const currentYear = new Date().getFullYear()
  const copyrightDate = 2023 + (currentYear > 2023 ? `-${currentYear}` : '')
  const skeleton = 'w-full h-6 animate-pulse rounded bg-muted/20'

  const copyrightName = COMPANY_NAME || SITE_NAME || 'Formula K'

  // `inline-flex min-h-6` keeps each link at the 24px minimum target size
  // without changing the visual rhythm of the column.
  const linkClass =
    'inline-flex min-h-6 items-center text-sm text-muted transition-colors hover:text-primary-ink'

  return (
    <footer className="mt-12 bg-secondary/40 sm:mt-16 dark:bg-secondary/10">
      {/* Newsletter — its own lighter surface so it reads as a band, not part of the footer pink */}
      <div className="border-b border-border/60 bg-card/60">
        <div className="container py-10 sm:py-12">
          <div className="mx-auto max-w-xl text-center">
            <h3 className="mb-2 font-serif text-2xl font-semibold text-foreground">
              Rejoignez le club Formula K
            </h3>
            <p className="mb-6 text-sm text-muted">
              Nouveautés, offres exclusives et conseils routine — une fois par semaine.
            </p>
            <form className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Votre adresse e-mail"
                className="flex-1 rounded-full bg-background px-5"
                name="email"
                placeholder="Votre adresse e-mail"
                type="email"
              />
              <Button className="w-full whitespace-nowrap sm:w-auto" type="submit">
                Je m’inscris
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="container py-10 sm:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link className="mb-4 flex items-center gap-2" href="/">
              <LogoIcon className="h-7 w-auto" />
              <span className="font-serif text-2xl font-bold text-foreground">{copyrightName}</span>
            </Link>
            <p className="max-w-xs text-sm text-muted">
              K-Beauty authentique, livrée partout en Tunisie et payée à la réception.
            </p>
          </div>

          <nav aria-labelledby="footer-shop">
            <h4
              className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase"
              id="footer-shop"
            >
              Boutique
            </h4>
            <ul className="space-y-3">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link className={linkClass} href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account">
            <h4
              className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase"
              id="footer-account"
            >
              Mon compte
            </h4>
            <ul className="space-y-3">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link className={linkClass} href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Help: the reassurance shoppers look for, plus a real way to reach us */}
          <div>
            <h4 className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
              Aide
            </h4>
            <ul className="space-y-3">
              {guarantees.map((item) => (
                <li className="flex items-start gap-2 text-sm text-muted" key={item.label}>
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" />
                  <span>{item.label}</span>
                </li>
              ))}
              {SMTP_FROM_ADDRESS ? (
                <li>
                  <a className={linkClass} href={`mailto:${SMTP_FROM_ADDRESS}`}>
                    Nous contacter
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          {/* Optional CMS-managed column. Hidden entirely when the global is empty,
              which is how the orphaned "Liens rapides" heading used to render. */}
          {menu.length > 0 ? (
            <div className="col-span-2 md:col-span-4">
              <h4 className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
                Liens rapides
              </h4>
              <Suspense
                fallback={
                  <div className="flex flex-col gap-2">
                    <div className={skeleton} />
                    <div className={skeleton} />
                    <div className={skeleton} />
                  </div>
                }
              >
                <FooterMenu menu={menu} />
              </Suspense>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60">
        <div className="container flex flex-col gap-5 py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-start">
              {[
                { href: 'https://instagram.com', label: 'Instagram', Icon: Instagram },
                { href: 'https://facebook.com', label: 'Facebook', Icon: Facebook },
                { href: 'https://wa.me/21600000000', label: 'WhatsApp', Icon: MessageCircle },
              ].map(({ href, label, Icon }) => (
                <a
                  aria-label={label}
                  className="rounded-full p-2.5 text-muted transition-colors hover:bg-card hover:text-primary-ink"
                  href={href}
                  key={label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>

            <p className="text-center text-sm text-muted sm:text-right">
              &copy; {copyrightDate} {copyrightName}. Tous droits réservés.
            </p>
          </div>

          {/* Appearance tooling for previewing palettes/themes. Kept out of the
              main row so it never squeezes the shopper-facing content on mobile. */}
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border/40 pt-4 text-xs text-muted sm:justify-end">
            <span className="text-[11px] tracking-wide uppercase opacity-70">Aperçu</span>
            <ThemeSelector />
            <PaletteSelector />
          </div>
        </div>
      </div>
    </footer>
  )
}
