import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  admin: {
    defaultColumns: ['alt', 'source', 'filename', 'updatedAt'],
    group: 'Content',
  },
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description:
          'Describes the image for screen readers and search engines. The AI assistant also matches on this text, so include the product and brand name.',
      },
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    /**
     * Provenance.
     *
     * The assistant can pull an image off the web when the library has no match.
     * Such an image is very rarely the brand's own packshot — it is usually a
     * stock or encyclopaedic photo under a Creative Commons licence — so the
     * origin has to be recorded with the file. Without these three fields a
     * web-sourced image is indistinguishable from a real product photo, and
     * nobody can answer "where did this come from, and may we use it?" later.
     */
    {
      name: 'source',
      type: 'select',
      admin: {
        description: 'Where this file came from. Web images are not official brand assets.',
        position: 'sidebar',
      },
      defaultValue: 'upload',
      options: [
        { label: 'Uploaded in the admin / chat', value: 'upload' },
        { label: 'Fetched from the web by the AI assistant', value: 'web' },
        { label: 'Seeded demo content', value: 'seed' },
      ],
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: {
        condition: (data) => data?.source === 'web',
        description: 'The page or file the image was downloaded from.',
        position: 'sidebar',
      },
    },
    {
      name: 'credit',
      type: 'text',
      admin: {
        description:
          'Author and licence, e.g. "Jane Doe · CC BY 4.0". Required by most Creative Commons licences when the image is published.',
        position: 'sidebar',
      },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
  },
}
