# Formula K

Tunisian ecommerce storefront + admin, built on the Payload CMS v3 ecommerce template. Next.js 15 (App Router, React 19) + Payload 3.72 + PostgreSQL. Cash-on-Delivery only (no Stripe checkout despite the dep). Includes a custom Rewards/loyalty system layered on top of the stock template.

## Stack

- **Framework**: Next.js 15.4 (App Router), React 19, TypeScript 5.7
- **CMS**: Payload 3.72 (`@payloadcms/db-postgres`, `@payloadcms/plugin-ecommerce`, `plugin-form-builder`, `plugin-seo`)
- **Storage**: S3/R2 via `@payloadcms/storage-s3` (only enabled when `R2_*` env vars present — see `src/plugins/index.ts`)
- **Email**: `@payloadcms/email-nodemailer` (SMTP env vars)
- **UI**: Tailwind v4, Radix UI, shadcn-style components in `src/components/ui`
- **Tests**: Vitest (unit + int projects) + Playwright (e2e)
- **Package manager**: pnpm

## Commands

```bash
pnpm dev                   # Next dev server
pnpm build                 # Production build
pnpm typecheck             # tsc --noEmit
pnpm lint                  # next lint
pnpm generate:types        # Regenerate src/payload-types.ts after schema changes
pnpm generate:importmap    # Regenerate admin import map after component changes
pnpm build:migrate         # Run Payload migrations
pnpm test                  # unit + int + e2e (sequential)
pnpm test:unit             # vitest unit project
pnpm test:int              # vitest int project
pnpm test:e2e              # playwright
pnpm scrape:anua           # scripts/scrape-anua.ts
pnpm import:products       # scripts/import-to-payload.ts
```

## Layout

```
src/
├── app/
│   ├── (app)/              # Storefront routes (home, shop, products, checkout, account, rewards, ...)
│   │   ├── (account)/      # account + orders (grouped layout)
│   │   └── [slug]/         # Payload Pages dynamic route
│   ├── (payload)/          # Payload admin panel routes
│   └── api/                # Custom Next route handlers
│       ├── checkout/cod/   # Cash-on-delivery order creation
│       ├── rewards/        # balance, catalog, checkin, history, join, redeem, seed
│       └── proxy-video/
├── collections/            # Users, Pages, Media, Brands, Categories, Products, Rewards/*
├── globals/                # Header, Footer, SiteSettings
├── blocks/                 # Layout-builder blocks (Content, MediaBlock, CTA, Carousel, ArchiveBlock, …)
├── heros/                  # Hero variants for Pages
├── components/             # Shared React components (Cart, Header, product/, rewards/, ui/, …)
├── access/                 # Access-control helpers (isAdmin, isDocumentOwner, adminOrSelf, …)
├── endpoints/seed/         # Admin seed endpoint
├── hooks/                  # Payload hooks
├── fields/                 # Reusable field factories
├── plugins/index.ts        # Plugin wiring (ecommerce, seo, form-builder, s3)
├── providers/              # React providers
├── utilities/              # Server/client helpers (getURL, …)
├── migrations/
├── payload.config.ts       # Main Payload config
└── payload-types.ts        # Generated — do not edit by hand
```

## Domain notes

- **Ecommerce**: wired via `ecommercePlugin` in `src/plugins/index.ts`. Users collection doubles as the `customers` slug. Products collection is overridden by `ProductsCollection` from `@/collections/Products`.
- **Payments**: `payments: undefined` — COD only. Orders are created through `/api/checkout/cod`. Stripe deps exist but checkout flow does not use them.
- **Rewards (custom, not from template)**: three collections in `src/collections/Rewards/` — `RewardTiers`, `RewardTransactions`, `RewardsCatalog`. Served via `/api/rewards/*` routes.
- **Pages**: layout-builder + draft/live-preview. Rendered via `app/(app)/[slug]/page.tsx` using `blocks/RenderBlocks.tsx`.
- **SEO**: `seoPlugin` with `generateTitle`/`generateURL` helpers; `getServerSideURL()` reads from env.
- **Media**: falls back to local disk when R2 env vars are not set.

## Conventions

- TypeScript strict; path alias `@/*` → `src/*`.
- After editing collections/globals/fields: run `pnpm generate:types`. After editing admin components or their paths: run `pnpm generate:importmap`.
- Access control lives in `src/access/`; reuse these helpers instead of inlining.
- Follow the security rules in `AGENTS.md` (local API `overrideAccess: false` when passing `user`, always forward `req` in nested ops inside hooks, guard hook recursion with `context` flags).
- Lint-staged blocks commits on ESLint warnings (`--max-warnings=0`). Husky runs this pre-commit.
- E2E tests live in `tests/e2e/*.e2e.spec.ts`; integration in `tests/int/api.int.spec.ts`; unit tests are colocated under `__tests__/` dirs (e.g. `src/access/__tests__/`).

## Environment

Required for full functionality: `DATABASE_URL` (Postgres, SSL enforced), `PAYLOAD_SECRET`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM_ADDRESS`/`SMTP_FROM_NAME`. Optional: `R2_BUCKET`/`R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` (enables S3/R2 media storage).

## See also

- `AGENTS.md` — full Payload CMS development rulebook (security, hooks, access, components). Read it before editing collections or hooks.
- `README.md` — upstream Payload ecommerce template docs.
