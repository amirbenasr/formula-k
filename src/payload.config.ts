import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { AiActionLog } from '@/collections/AiActionLog'
import { Brands } from '@/collections/Brands'
import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Users } from '@/collections/Users'
import { RewardTiers, RewardTransactions, RewardsCatalog } from '@/collections/Rewards'
import { adminAiApplyEndpoint } from '@/endpoints/adminAi/apply'
import { adminAiChatEndpoint } from '@/endpoints/adminAi/chat'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { SiteSettings } from '@/globals/SiteSettings'
import { getSmtpConfig, SMTP_SETUP_HINT } from '@/utilities/smtp'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const smtp = getSmtpConfig()

if (!smtp.configured) {
  console.warn(
    `[email] SMTP is not configured — email verification and password reset links will NOT be sent. ${SMTP_SETUP_HINT}`,
  )
}

export default buildConfig({
  admin: {
    components: {
      afterNavLinks: ['@/components/AIAssistant/NavLink#AIAssistantNavLink'],
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
      graphics: {
        Logo: '@/components/Logo/Logo#Logo',
        Icon: '@/components/Logo/Logo#Icon',
      },
      // A custom AdminViewConfig has no `navLink` property, so the sidebar entry
      // is contributed separately via afterNavLinks above.
      views: {
        aiAssistant: {
          Component: '@/components/AIAssistant/View#AIAssistantView',
          exact: true,
          meta: { title: 'AI Assistant' },
          path: '/ai',
        },
      },
    },
    meta: {
      titleSuffix: '— Formula K',
      icons: [{ rel: 'icon', type: 'image/png', url: '/logo.png' }],
    },
    user: Users.slug,
  },
  collections: [
    Users,
    Pages,
    Categories,
    Brands,
    Media,
    RewardTiers,
    RewardTransactions,
    RewardsCatalog,
    AiActionLog,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
      // Managed Postgres (Neon, Supabase, RDS, ...) requires TLS by default.
      // Local development against docker-compose.yml sets DB_SSL=false.
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: true },
    },
    // Migrations are the source of truth for the schema, so the silent dev push
    // is off by default. It used to create tables in development that no
    // migration described, which is how this repo ended up with a local schema
    // that production had no way to reproduce.
    //
    // When you are iterating on a collection and do not want to write a
    // migration for every intermediate save, opt in with:
    //   DB_PUSH=true pnpm dev
    // ...then generate a migration (`pnpm db:migrate:create <name>`) before you
    // merge. `pnpm db:migrate` applies migrations to the database you point at.
    push: process.env.DB_PUSH === 'true',
  }),
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: ({ linkType }) => linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  email: nodemailerAdapter({
    defaultFromAddress: smtp.defaultFromAddress,
    defaultFromName: smtp.defaultFromName,
    // With SMTP unset there is nothing to connect to, and verifying only
    // produces a misleading "Error verifying Nodemailer transport" on every
    // boot and HMR reload. The warning above explains what is actually missing.
    skipVerify: !smtp.configured,
    transportOptions: smtp.transportOptions,
  }),
  // The admin AI assistant. Both routes enforce admin auth in their handlers,
  // because Payload custom endpoints are unauthenticated by default.
  endpoints: [adminAiChatEndpoint, adminAiApplyEndpoint],
  globals: [Header, Footer, SiteSettings],
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Sharp is now an optional dependency -
  // if you want to resize images, crop, set focal point, etc.
  // make sure to install it and pass it to the config.
  // sharp,
})
