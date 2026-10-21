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
     * The assistant can pull an image off the web when the library has no match,
     * and a web image is somebody else's photograph — the brand's packshot on its
     * own site, or a retailer's listing. It is not a licensed asset. Recording
     * where it came from is what lets an admin answer "may we publish this?" for
     * a photo that is otherwise indistinguishable from one we own.
     */
    {
      name: 'source',
      type: 'select',
      admin: {
        description: 'Where this file came from. Web images are not licensed assets.',
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
          'Who the image came from, e.g. "Anua" or "YesStyle". The web tier fills this from the search result.',
        position: 'sidebar',
      },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
  },
}
