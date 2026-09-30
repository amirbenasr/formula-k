import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { createGlobalRevalidateHook } from '@/hooks/revalidateStorefront'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [createGlobalRevalidateHook('footer')],
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
