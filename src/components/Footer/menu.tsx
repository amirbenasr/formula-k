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
      <ul className="space-y-3 grid grid-cols-2 gap-x-8">
        {menu.map((item) => {
          return (
            <li key={item.id}>
              <CMSLink
                appearance="link"
                {...item.link}
                className="text-sm text-muted hover:text-primary transition-colors"
              />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
