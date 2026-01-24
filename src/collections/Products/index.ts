import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { DefaultDocumentIDType, slugField, Where } from 'payload'

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['title', 'enableVariants', '_status', 'variants.variants'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'products',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    ...defaultCollection?.defaultPopulate,
    title: true,
    slug: true,
    variantOptions: true,
    variants: true,
    enableVariants: true,
    gallery: true,
    priceInUSD: true,
    inventory: true,
    meta: true,
    videos: true,
    featuredInVideoShowcase: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: false,
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
              minRows: 1,
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'variantOption',
                  type: 'relationship',
                  relationTo: 'variantOptions',
                  admin: {
                    condition: (data) => {
                      return data?.enableVariants === true && data?.variantTypes?.length > 0
                    },
                  },
                  filterOptions: ({ data }) => {
                    if (data?.enableVariants && data?.variantTypes?.length) {
                      const variantTypeIDs = data.variantTypes.map((item: any) => {
                        if (typeof item === 'object' && item?.id) {
                          return item.id
                        }
                        return item
                      }) as DefaultDocumentIDType[]

                      if (variantTypeIDs.length === 0)
                        return {
                          variantType: {
                            in: [],
                          },
                        }

                      const query: Where = {
                        variantType: {
                          in: variantTypeIDs,
                        },
                      }

                      return query
                    }

                    return {
                      variantType: {
                        in: [],
                      },
                    }
                  },
                },
              ],
            },

            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock],
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            ...defaultCollection.fields,
            {
              name: 'relatedProducts',
              type: 'relationship',
              filterOptions: ({ id }) => {
                if (id) {
                  return {
                    id: {
                      not_in: [id],
                    },
                  }
                }

                // ID comes back as undefined during seeding so we need to handle that case
                return {
                  id: {
                    exists: true,
                  },
                }
              },
              hasMany: true,
              relationTo: 'products',
            },
          ],
          label: 'Product Details',
        },
        {
          label: 'Videos',
          description: 'Add product demo videos and manage video showcase settings',
          fields: [
            {
              name: 'featuredInVideoShowcase',
              type: 'checkbox',
              label: 'Feature in Video Showcase',
              defaultValue: false,
              admin: {
                description: 'Display this product in the homepage video showcase section',
              },
            },
            {
              name: 'videos',
              type: 'array',
              label: 'Product Videos',
              admin: {
                description: 'Add demo videos, tutorials, or UGC content for this product',
              },
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  label: 'Video Title',
                  admin: {
                    description: 'Short title for the video (e.g., "How to apply", "Before & After")',
                  },
                },
                {
                  name: 'videoType',
                  type: 'select',
                  label: 'Video Source',
                  defaultValue: 'upload',
                  options: [
                    { label: 'Upload Video', value: 'upload' },
                    { label: 'External URL (YouTube, TikTok, etc.)', value: 'external' },
                  ],
                },
                {
                  name: 'videoFile',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Video File',
                  admin: {
                    condition: (data, siblingData) => siblingData?.videoType === 'upload',
                    description: 'Upload MP4, WebM, or MOV file',
                  },
                },
                {
                  name: 'externalUrl',
                  type: 'text',
                  label: 'External Video URL',
                  admin: {
                    condition: (data, siblingData) => siblingData?.videoType === 'external',
                    description: 'Paste YouTube, TikTok, or Instagram video URL',
                  },
                },
                {
                  name: 'thumbnail',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Video Thumbnail',
                  admin: {
                    description: 'Custom thumbnail image for the video (recommended: 9:16 ratio for vertical videos)',
                  },
                },
                {
                  name: 'isVertical',
                  type: 'checkbox',
                  label: 'Vertical Video (9:16)',
                  defaultValue: true,
                  admin: {
                    description: 'Check if this is a vertical/portrait video (TikTok, Reels style)',
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        position: 'sidebar',
        sortOptions: 'title',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    {
      name: 'brand',
      type: 'relationship',
      relationTo: 'brands',
      required: true,
      admin: {
        position: 'sidebar',
        sortOptions: 'title',
      },
    },
    slugField(),
  ],
})
