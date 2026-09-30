'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const HREF = '/admin/ai'

/**
 * Nav entry for the assistant.
 *
 * Payload's AdminViewConfig has no `navLink` property, so a custom view does not
 * appear in the sidebar on its own — registering this via
 * `admin.components.afterNavLinks` is the supported way to add it.
 */
export function AIAssistantNavLink() {
  const pathname = usePathname()
  const active = Boolean(pathname?.startsWith(HREF))

  return (
    <Link className={['nav__link', active && 'nav__link--active'].filter(Boolean).join(' ')} href={HREF}>
      <span className="nav__link-label">AI Assistant</span>
    </Link>
  )
}
