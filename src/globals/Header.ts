import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { createGlobalRevalidateHook } from '@/hooks/revalidateStorefront'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [createGlobalRevalidateHook('header')],
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
}
