'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  href: string
  title: string
}

/** Catalogue tab. Active state matches the header nav and the shop sidebar. */
export function Item({ href, title }: Props) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <li className="flex">
      <Link
        aria-current={active ? 'page' : undefined}
        className={clsx(
          'block whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors',
          active
            ? 'bg-primary/10 font-medium text-primary-ink'
            : 'text-foreground/75 hover:text-primary-ink',
        )}
        href={href}
      >
        {title}
      </Link>
    </li>
  )
}
