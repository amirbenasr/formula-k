import { slugField } from 'payload'
import type { CollectionConfig } from 'payload'

import { categoryRevalidate } from '@/hooks/revalidateStorefront'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
  },
  hooks: {
    afterChange: [categoryRevalidate.afterChange],
    afterDelete: [categoryRevalidate.afterDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
  ],
}
