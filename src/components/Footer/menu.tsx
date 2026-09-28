import type { Footer } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import React from 'react'

interface Props {
  menu: Footer['navItems']
}

export function FooterMenu({ menu }: Props) {
  if (!menu?.length) return null

  return (
    <nav>
      <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
        {menu.map((item) => {
          return (
            <li key={item.id}>
              <CMSLink
                appearance="link"
                {...item.link}
                className="inline-flex min-h-6 items-center text-sm text-muted hover:text-primary-ink transition-colors"
              />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
