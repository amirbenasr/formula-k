import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
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

/**
 * The storage plugin is *always* registered and only toggled with `enabled`.
 *
 * Registering it conditionally broke the admin panel in production: the plugin
 * contributes the `@payloadcms/storage-s3/client#S3ClientUploadHandler` entry to
 * `admin.dependencies`, and therefore to the generated import map. Locally the
 * `R2_*` values are placeholders, so the plugin was dropped from the config and
 * `pnpm generate:importmap` wrote a map *without* that entry. On Vercel the real
 * credentials turn the plugin on, the config then references a component the
 * committed import map does not know, and every `/admin` render logs
 * `getFromImportMap: PayloadComponent not found in importMap` and serves an
 * error-fallback page.
 *
 * `enabled: false` is the plugin's own off switch (`isPluginDisabled`): it returns
 * the config untouched, so media keeps falling back to local disk, and the client
 * upload handler renders its children without wiring an uploader. Passing it keeps
 * `admin.dependencies` — and the import map — identical in every environment.
 */
const isR2Enabled = hasValidR2Config()

const s3StoragePlugin: Plugin = s3Storage({
  bucket: process.env.R2_BUCKET || '',
  collections: {
    media: true,
  },
  config: {
    endpoint: process.env.R2_ENDPOINT || '',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    region: 'auto',
  },
  /**
   * Keep the storage plugin's columns in the collection schema even when the
   * plugin is switched off.
   *
   * `enabled` is environment-dependent (only production has real R2 credentials),
   * and the plugin injects its own fields — `_objectKey` and `prefix` — into the
   * upload collection. Before this flag, those fields existed only where the
   * plugin was on, which made the *schema* environment-dependent: local dev and
   * CI built `media` without `_objectkey`, so the migration generated from that
   * config did not add the column either, while production (plugin on) selected
   * `media._objectkey` on every read and died with `column "_objectkey" does not
   * exist` (Postgres 42703). Payload 3.90 introduced the `_objectKey` field, which
   * is why this only started failing after the upgrade.
   *
   * With `alwaysInsertFields: true` both branches produce identical fields, so
   * migrations, the CI drift check and `payload-types.ts` all match production
   * regardless of which env vars happen to be set. It does not enable S3:
   * `enabled: false` still leaves uploads on local disk. Payload v4 makes this
   * the default.
   */
  enabled: isR2Enabled,
  alwaysInsertFields: true,
})

/**
 * NOTE ON THE MCP PLUGIN (@payloadcms/plugin-mcp)
 *
 * It is installed and version-matched to Payload 3.72.0, but deliberately NOT
 * registered here. Registering it adds a second auth-enabled collection
 * (`payload-mcp-api-keys`), which widens `req.user` from `User` to
 * `(User & { collection: 'users' }) | (PayloadMcpApiKey & { collection: 'payload-mcp-api-keys' })`.
 * That breaks the type signature of every access helper in `src/access/` and the
 * rewards routes, because they all assume a single user shape.
 *
 * The plugin adds that collection even when `disabled: true` — by design, so the
 * database schema stays stable for migrations — so there is no way to register it
 * "off" without the type widening.
 *
 * To enable MCP later, the access helpers must be narrowed by collection first
 * (e.g. `if (user?.collection !== 'users') return false` before `checkRole`).
 * See docs/admin-ai-assistant.md.
 */
export const plugins: Plugin[] = [
  s3StoragePlugin,
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
