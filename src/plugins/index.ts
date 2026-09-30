import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { Plugin } from 'payload'

import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { ProductsCollection } from '@/collections/Products'
import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Formula K` : 'Formula K — K-Beauty en Tunisie'
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

/**
 * Placeholder values shipped in `.env.example` (e.g. "your-bucket-name",
 * "https://<account-id>.r2.cloudflarestorage.com") are truthy strings, so a naive
 * presence check would enable remote storage locally. That made every uploaded
 * file unreadable: media URLs returned by the API pointed at a fake S3 endpoint
 * and each image request failed with ERR_INVALID_URL.
 */
/**
 * Public base URL for the bucket (Cloudflare R2 custom domain or r2.dev host).
 *
 * When it is configured, media URLs are absolute and point straight at the CDN.
 * Without it Payload emits `/api/media/file/<filename>`, which means every
 * product photo is streamed through a Vercel function that first has to read the
 * database — slow, metered, and a single point of failure shared with the CMS.
 */
const r2PublicURL = (
  process.env.R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_URL ||
  process.env.NEXT_PUBLIC_MEDIA_URL ||
  ''
).replace(/\/+$/, '')

/** Mirrors `@payloadcms/storage-s3`'s own URL builder so size variants resolve. */
const buildMediaURL = ({ filename, prefix = '' }: { filename: string; prefix?: string }) =>
  `${r2PublicURL}/${path.posix.join(prefix, encodeURIComponent(filename))}`

function hasValidR2Config() {
  const { R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env

  const values = [R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]

  if (values.some((value) => !value)) return false

  const looksLikePlaceholder = values.some((value) =>
    /your-|<[^>]+>|example\.com|changeme/i.test(value as string),
  )

  if (looksLikePlaceholder) return false

  try {
    new URL(R2_ENDPOINT as string)
  } catch {
    return false
  }

  return true
}

// Only enable S3/R2 storage when real credentials are configured;
// otherwise media is stored on local disk.
const s3StoragePlugin: Plugin[] = hasValidR2Config()
  ? [
      s3Storage({
        collections: {
          media: r2PublicURL
            ? {
                generateFileURL: buildMediaURL,
              }
            : true,
        },
        bucket: process.env.R2_BUCKET as string,
        config: {
          endpoint: process.env.R2_ENDPOINT as string,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
          },
          region: 'auto',
        },
      }),
    ]
  : []

export const plugins: Plugin[] = [
  ...s3StoragePlugin,
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    customers: {
      slug: 'users',
    },
    // Online payments disabled - using Cash on Delivery only
    payments: undefined,
    products: {
      productsCollectionOverride: ProductsCollection,
    },
  }),
]
