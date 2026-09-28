# Formula K / SouGlowy — Storefront & Tech Revamp Plan

**Status:** proposal (analysis + plan only — no behavior changed yet)
**Scope:** technology evaluation, onboarding/zero-config, first impression, interactivity, conversion
**Repo state:** branch `office/pixel-0e15`, Payload 3.72 + Next 15.4, Postgres, COD-only

---

## 1. Verdict (read this first)

**Keep the stack.** Next.js 15 (App Router / React Server Components) + Payload 3 + PostgreSQL
+ Tailwind v4 / Radix is a *strong, well-adapted* base for a Tunisian cash-on-delivery store:
single language (TypeScript), one repo for storefront + admin, real ACID database for
orders/inventory, and an existing custom Rewards system already built on it.

**Do not replatform.** Replacing Payload/Next with Shopify, Medusa, WooCommerce, etc. would cost
weeks of migration and would not fix any of the problems you actually described. All of your
pain is in three places that are cheap to fix:

1. **Onboarding / DX** — a fresh clone cannot start without you manually standing up Postgres,
   and there is no demo data, so the homepage has nothing to show.
2. **First impression** — the homepage literally renders a *"Pas encore de produits"* admin
   placeholder in the "Produits Vedettes" slot, and its two hero buttons point at routes that
   do not exist.
3. **Conversion + interactivity** — dead buttons, non-functional search, USD-vs-TND mismatch,
   mixed French/English, no reviews, no analytics, no abandonment recovery, few client-side
   interactions that push a visitor toward checkout.

The rest of this document is the evidence, the technology decision, and a phased plan.

---

## 2. What the code actually does today (evidence)

### 2.1 Onboarding is broken for a fresh clone

| # | Finding | Evidence |
|---|---------|----------|
| B1 | `pnpm dev` on a fresh clone cannot connect to a DB. `DATABASE_URL` is a placeholder and there is no `.env`. | `.env.example:2`; no `.env` in repo |
| B2 | The Postgres adapter forces SSL (`rejectUnauthorized: true`), so a local/Docker Postgres without TLS also fails. | `src/payload.config.ts:49-56` |
| B3 | No `docker-compose.yml`, no helper script, no `pnpm setup`. README only says `cp .env.example .env && pnpm dev`. | `README.md:45-52`; repo root |
| B4 | The only Payload migration is Postgres-specific. Switching DB engines means regenerating migrations. | `src/migrations/20260122_205052.ts` |
| B5 | The seed endpoint is a no-op (call commented out) and seeds only template demo pages, not the product catalog. | `src/app/(app)/next/seed/route.ts:23`; `src/endpoints/seed/*` |
| B6 | A product import script exists (`scripts/import-to-payload.ts` / `scrape:anua`) but is not wired into onboarding. | `package.json:11-12` |
| B7 | The only checked-in migration predates the Rewards collections, so `payload migrate` on a fresh DB yields an incomplete schema and dev schema-push then asks an interactive "create or rename enum?" question. | `src/migrations/20260122_205052.ts` (0 reward references); reproduced during verification |

> Result: the very first thing a new dev/owner experiences is "set up a PostgreSQL connection",
> then an empty shop. This is a tooling/config problem, **not** a reason to change framework.

### 2.2 The homepage shows no products

| # | Finding | Evidence |
|---|---------|----------|
| H1 | "Produits Vedettes" is a hardcoded placeholder reading *"Pas encore de produits. Ajoutez des produits dans le panneau admin."* with a button to `/admin`. | `src/app/(app)/page.tsx:108-131` |
| H2 | Hero primary CTA **"Découvrir"** → `/products`, which is not a listing route. The only listing is `/shop`. | `page.tsx:54`; routes under `src/app/(app)/` |
| H3 | Hero secondary CTA **"Voir les Routines"** → `/routines`, which does not exist. | `page.tsx:58,235` |
| H4 | "Acheter par Catégorie" uses 6 hardcoded French slugs + Unsplash URLs, not the real `categories` collection. | `page.tsx:140-199` |
| H5 | The hero image and "Why K-Beauty" image are hardcoded Unsplash URLs, not CMS media. | `page.tsx:66-72,205-211` |
| H6 | There is no `/products` page (only `products/[slug]`). The root catch-all `[slug]` swallows `/products` and 404s if no CMS page named "products" exists. | `src/app/(app)/products/[slug]/page.tsx`; `src/app/(app)/[slug]/page.tsx` |
| H7 | The only product-driven section (Video Showcase) renders **only** if products have `featuredInVideoShowcase = true` *and* a video — i.e. normally nothing. | `page.tsx:23-37,106` |
| H8 | Branding is inconsistent: page title says `SouGlowy`, header/footer say `Formula K`. | `page.tsx:9`; `src/components/Header/index.client.tsx:55`; `src/globals/SiteSettings.ts:33` |

> Result: a first-time visitor sees a hero with two broken buttons and, further down, an
> "add products in admin" message — the opposite of a buying experience.

### 2.3 Dead / broken / non-functional elements (conversion leaks)

| # | Element | Problem | Evidence |
|---|---------|---------|----------|
| D1 | Header search input | No `onSubmit`/`onChange`; typing does nothing. No `/search` page, no search API route. | `Header/index.client.tsx:118-133`; `src/app/api/` |
| D2 | Header + mobile wishlist icon | Links to `/wishlist`, which does not exist. | `Header/index.client.tsx:103-109`; `Header/MobileNav.tsx:114` |
| D3 | Checkout "Continue shopping?" | Links to `/search` (does not exist) instead of `/shop`. | `checkout/CheckoutPage.tsx:140`; `logout/LogoutPage/index.tsx:34` |
| D4 | Video Showcase **"Ajouter au panier"** | `<button>` with no `onClick` — a dead primary CTA. | `components/VideoShowcase/index.tsx:361-366` |
| D5 | Video Showcase price | Prints `priceInUSD` with a `TND` suffix. | `VideoShowcase/index.tsx:143-146` |
| D6 | Footer newsletter form | No `onSubmit`/action; standard submit reloads the page. | `Footer/index.tsx:35-47` |
| D7 | Footer links | `/contact`, `/faq`, `/shipping`, `/returns`, `/about`, `/privacy`, `/terms` — none exist as routes (only resolve if an admin creates CMS pages). | `Footer/index.tsx:80-144` |
| D8 | Footer social links | Point to `instagram.com`, `facebook.com`, `wa.me/1234567890` (placeholder WhatsApp number). | `Footer/index.tsx:163-189` |
| D9 | `CategoryTabs` | Fully implemented but **never imported anywhere** — the shop has no category navigation. | grep: only self-reference in `components/CategoryTabs/index.tsx:46` |
| D10 | Shop filters/sort | `sort` and `category` query params are read but no UI renders them; no sort control. | `app/(app)/shop/page.tsx:19,33` |
| D11 | Product page | No reviews, no ratings, no "recently viewed", no sticky add-to-cart, no delivery/warranty info. | `product/ProductDescription.tsx` |

### 2.4 Currency and language are mismatched

| # | Finding | Evidence |
|---|---------|----------|
| C1 | `Price` renders via the ecommerce plugin's `useCurrency().formatCurrency`; the plugin has no currency configured, so it defaults to **USD**. | `components/Price.tsx:35-49`; `src/plugins/index.ts:92-108` (no `currencies`) |
| C2 | The DB enums only allow `'USD'` for carts/orders/transactions. | `src/migrations/20260122_205052.ts:50,52,55,873,904,948` |
| C3 | The COD endpoint writes `currency: 'USD'` and computes points as "1 point per TND". | `src/app/api/checkout/cod/route.ts:80,127-131` |
| C4 | A correct TND formatter **already exists but is unused** (`formatPrice(price, 'fr-TN')`). | `src/lib/utils.ts:8-15` (no importers) |
| C5 | Product field is `priceInUSD`; sort constants reference `priceInUSD`. | `src/lib/constants.ts:16-17` |
| C6 | Storefront copy is French, but header announcement, product page, shop page, and forms are English. | `Header/index.client.tsx:36`; `product/ProductDescription.tsx:108`; `shop/page.tsx` |
| C7 | `next.config.js` allows remote images only from `NEXT_PUBLIC_SERVER_URL` + Unsplash, so CMS media served from R2/custom domain will break `next/image`. | `next.config.js:9-24` |

### 2.5 What is already good (keep and lean on it)

- Clean Payload structure: collections, globals, access helpers, hooks, fields, migrations
  (`CLAUDE.md`, `AGENTS.md`).
- Custom **Glow Rewards** loyalty system with tiers, catalog, daily check-in, referrals
  (`src/collections/Rewards/*`, `src/app/api/rewards/*`, `components/rewards/*`).
- Video showcase / shoppable-video groundwork (`components/VideoShowcase`, `product/ProductVideos`).
- Guest + account checkout with COD, inventory checks, points on order
  (`src/app/api/checkout/cod/route.ts`).
- Radix/shadcn UI kit, Tailwind v4, dark mode, palette system.
- A real test suite (Vitest unit/int + Playwright e2e) — rare and valuable.
- Draft/preview, SEO plugin, layout builder, form builder already wired.

---

## 3. Technology decision

### 3.1 Evaluation criteria

| Criterion | Weight for Formula K |
|---|---|
| COD-first checkout (Tunisia, no card gateways) | **Critical** |
| TND / French (+ Arabic later) | **Critical** |
| Low ops burden for a small team | High |
| Conversion tooling (reviews, upsells, analytics, email) | High |
| DX / onboarding | High |
| Ability to keep the custom Rewards system | Medium |
| Total cost (hosting, fees, licenses) | Medium |
| Time to migrate | High (avoid if possible) |

### 3.2 Options considered

| Option | COD/Tunisia fit | DX | Conversion tooling | Migration cost | Verdict |
|---|---|---|---|---|---|
| **Keep Next 15 + Payload 3 + Postgres** (current) | Good — COD already works | Good (TS monorepo) | Build-it (already have Rewards, video) | **None** | ✅ **Recommended** |
| Medusa v2 + Next storefront | Good, but you rebuild storefront + admin | Medium | Strong commerce primitives | High (weeks) | ❌ Not worth it now |
| Shopify (headless Hydrogen or Liquid) | Weak — COD is non-standard, needs apps; per-transaction fees; data leaves TN | High | Best-in-class | High + recurring cost | ❌ Only if you want to stop owning infra |
| WooCommerce / WordPress | Medium (COD plugins exist) | Poor (PHP, plugin sprawl) | Good plugins | High (rewrite) | ❌ Worse DX/security |
| Strapi / EverShop | Medium | Medium | Weak for ecommerce | High | ❌ Sidegrade |
| Custom Next + Prisma | Total control | Medium | Build everything | Very high | ❌ Rebuild what Payload gives free |

### 3.3 Recommendation

**Keep the core stack.** Apply four targeted adaptations:

1. **Zero-config local dev** — Docker Postgres + one `pnpm setup` command that writes `.env`,
   generates `PAYLOAD_SECRET`, waits for the DB, runs migrations, and seeds a demo catalog.
   Make SSL conditional on env so both local and managed Postgres work.
2. **Refactor the storefront layer** (not Payload) around conversion: real product-first
   homepage, working navigation/search/filters, quick-add, reviews, trust signals, TND.
3. **Localize properly** — TND everywhere, French UI (Arabic/Darija as a second locale later).
4. **Instrument and grow** — analytics events, abandoned-cart email, referral, wishlist.

Estimated shape of work: ~1 week for P0 (onboarding + first impression + broken links),
~2–3 weeks for P1 (conversion + localization + interactivity), then continuous P2 growth.

### 3.4 When to revisit the platform

Reconsider only if: (a) you want to hand logistics/payments to a platform and accept fees,
(b) order volume outgrows a single Postgres instance, or (c) you need multi-country/multi-currency
at scale. None of those are true today.

---

## 4. The conversion problem, ranked

Ordered by impact ÷ effort:

1. **First 5 seconds** — show buyable products above the fold. (Highest)
2. **Remove broken trust** — no 404 CTAs, working search, consistent brand/language.
3. **Correct money** — TND, no USD leakage, correct totals at checkout.
4. **Frictionless add-to-cart → COD checkout** — quick add, cart drawer, one-page checkout.
5. **Confidence** — reviews, delivery estimate, COD explanation, WhatsApp support.
6. **Interaction that sells** — shoppable video (fix the dead button), bundles/routines, wishlist.
7. **Come-back loops** — abandoned cart, rewards surfaced, back-in-stock, referrals.

---

## 5. The plan

### Phase 0 — Zero-config onboarding & seed data (P0, ~1–2 days)

**Goal:** a fresh clone reaches a running shop *with demo products* using one command, with no
manual Postgres setup.

- [ ] Add `docker-compose.yml` with `postgres:16` and a named volume; expose 5432.
- [ ] Make SSL conditional in `src/payload.config.ts`:
      `ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: true }`.
- [ ] Add `.env.development` sane defaults (`DATABASE_URL=postgresql://payload:payload@localhost:5432/formula_k`,
      `DB_SSL=false`, dev `PAYLOAD_SECRET`) and keep `.env` git-ignored.
- [ ] Add `scripts/setup.ts` + `pnpm setup`: copy env if missing → generate `PAYLOAD_SECRET`
      (crypto) → `docker compose up -d --wait` → seed. **Done in the first pass** — local dev
      relies on Payload's schema push rather than `payload migrate`, because the checked-in
      migration is incomplete (see B7). Regenerating it is a Phase 6 task.
- [ ] Replace the no-op `/next/seed` with a real **seed product catalog** (20–40 products, real
      categories/brands, images from `public/` or R2) and a `featured`/bestseller flag. Keep the
      existing template page seed optional.
- [ ] Wire `pnpm import:products` into setup as an optional step for the Anua scrape.
- [ ] Document the one-command flow in `README.md`; keep `.env.example` accurate.
- [ ] Bonus: add a `DB_ADAPTER` env with `@payloadcms/db-sqlite` as an "instant demo, no Docker"
      path (dev only; regenerate migrations separately). **Optional**, only if Docker is a blocker.

**Acceptance:** `git clone && pnpm i && pnpm setup && pnpm dev` → homepage shows ≥6 real products;
no manual DB steps.

### Phase 1 — First impression & crawl-ability (P0, ~2–3 days)

**Goal:** the homepage looks like a shop and every CTA/route works.

- [ ] Create a canonical listing at **`/shop`** and add a permanent redirect `/products → /shop`
      (or add `/products/page.tsx` aliasing it). Update all internal links.
- [ ] Replace the "Produits Vedettes" placeholder with a real query:
      featured/bestseller → fallback to latest published in-stock products. Render with
      `ProductGridItem` (or a richer `ProductCard`).
- [ ] Add a curated CMS global `HomePage` (or extend `SiteSettings`) with: hero copy/image,
      featured product relationships, category highlights, promo banner — all editable in admin.
- [ ] Fix hero CTAs to `/shop` and either build `/routines` or remove the button.
- [ ] Drive "Acheter par Catégorie" from the `categories` collection (real images), not hardcoded slugs.
- [ ] Replace hardcoded Unsplash images with `Media` uploads.
- [ ] Resolve branding: one name (SouGlowy vs Formula K) across metadata, header, footer, admin.
- [ ] Add `loading.tsx`/`error.tsx`/`not-found.tsx` for the storefront and a useful 404 that links to `/shop`.
- [ ] Fix/neutralize every dead link from §2.3 (D1–D8): wishlist, footer pages, newsletter,
      socials, checkout "Continue shopping".

**Acceptance:** no internal link 404s; homepage shows real products in the first viewport;
Lighthouse SEO/best-practices clean; existing e2e navigation/homepage tests still pass.

### Phase 2 — Money & language correctness (P0–P1, ~2 days)

**Goal:** the store charges in TND and speaks one language to the customer.

- [ ] Configure the ecommerce plugin for **TND** (currency + locale) and migrate
      `priceInUSD` → `price`/`priceInTND`. Add a migration; keep a read-compat shim if needed.
- [ ] Route all price rendering through the single `formatPrice` helper (`src/lib/utils.ts`) or a
      TND-aware `Price`; delete the USD plugin path.
- [ ] Update COD order currency, sort constants (`src/lib/constants.ts`), JSON-LD `priceCurrency`,
      and rewards wording to TND.
- [ ] Choose French as the storefront UI default and translate remaining English strings
      (product page, shop, forms, footer, header announcement). Add Payload localization for
      content if/when Arabic is wanted.
- [ ] Add `remotePatterns` for the R2/CDN media host in `next.config.js` (or an image loader).

**Acceptance:** no "USD" shown to customers anywhere; cart/order totals in TND match product
prices; French copy throughout the storefront.

### Phase 3 — Conversion & interactivity core (P1, ~1 week)

**Goal:** make browsing and buying fluid, interactive, and persuasive.

- [ ] **Working search**: debounced server route `/api/search` (Payload `like` on title/description/
      tags/brand) + a client command palette/overlay with product thumbnails, prices, quick-add.
- [ ] **Quick add to cart** from grid/card and search results (optimistic, toast, no page jump).
- [ ] **Cart drawer** polish: line-item edit, delivery threshold progress ("Free shipping X TND
      away"), cross-sells, persistent cart.
- [ ] **Product page**: sticky add-to-cart bar, image zoom/lightbox, variant selector UX, stock
      urgency, delivery estimate ("Livraison 24–48h à Tunis"), COD trust badge, share.
- [ ] **Reviews & ratings** (new `Reviews` collection + aggregate rating + photo reviews),
      gated to verified orders; surface stars on cards and JSON-LD.
- [ ] **Fix the shoppable Video Showcase "Ajouter au panier"** to actually add the product.
- [ ] **Category/sort/filter UI**: render the unused `CategoryTabs`, add price/brand/availability
      filters and sort (uses the already-parsed `sort`/`category` params).
- [ ] **Wishlist**: real collection + routes behind the existing heart icon.
- [ ] **Recently viewed** and **related/recommended** rails (relatedProducts already exists).
- [ ] **Homepage interactivity**: promo countdown/banner, bestseller carousel, testimonials,
      "Shop the routine" builder, bundles.

**Acceptance:** a visitor can search → quick-add → view drawer → checkout with no dead ends;
reviews render; video CTA adds to cart; filter/sort work client-side without full reloads.

### Phase 4 — Checkout & COD optimization (P1, ~4–6 days)

**Goal:** the COD funnel converts with minimal friction.

- [ ] One-page checkout with clear steps; phone-first for Tunisia (+216 mask/validation).
- [ ] Governorate / city select (structured), delivery-fee + ETA by region, address autocomplete.
- [ ] Guest checkout without forcing account creation; order tracking by phone/order id
      (`find-order` already exists — link it after purchase).
- [ ] COD order confirmation email/SMS with a proper French template (SMTP is wired).
- [ ] Prevent double-submit; idempotency on order creation; server-side total re-validation.
- [ ] Point-of-sale fee transparency (COD fee, shipping) before "Place Order".
- [ ] Abandoned-cart capture (email/phone) + recovery email sequence (Payload jobs / cron).

**Acceptance:** measurable drop-off per step; order created once; customer receives confirmation;
totals match cart exactly.

### Phase 5 — Growth loops & analytics (P2, ~1 week)

- [ ] GA4 + Meta Pixel + TikTok Pixel with server-side events: `view_item`, `add_to_cart`,
      `begin_checkout`, `purchase` (COD = order placed), `search`, `view_promotion`.
- [ ] Conversion dashboard (simple admin view or GA): ATC rate, checkout completion, AOV, repeat rate.
- [ ] Loyalty surfaced earlier: earn/points preview on product & cart, post-purchase points,
      tier progress; referral link sharing.
- [ ] Email marketing integration; back-in-stock notifications; birthday coupons.
- [ ] A/B testing hook for hero/pricing/CTA (feature flag or Payload global variant).

### Phase 6 — Platform hardening (P2, ongoing)

- [ ] Migration hygiene: every schema change ships a migration; CI runs `build:migrate`.
- [ ] `generate:types` + `generate:importmap` in CI/pre-commit; fix any drift.
- [ ] Tests for new flows (search, quick-add, reviews, TND formatting) in the existing suites.
- [ ] ISR/`unstable_cache` + `revalidate` on product/category changes; image optimization.
- [ ] Security pass per `AGENTS.md`: `overrideAccess: false` where users are passed, `req` in
      nested hook ops, validate the COD endpoint input (currently trusts client `userId`).
- [ ] Deployment recipe: managed Postgres (Neon/Supabase) + Vercel + R2 media + SMTP.

> ⚠️ Security note found during analysis: `/api/checkout/cod` accepts `userId` from the request
> body and uses it to award points (`route.ts:11,76,120-133`). It should derive the user from the
> authenticated session (`req.user`) and verify cart ownership. Add to Phase 4/6.

---

## 6. Interactivity backlog (ideas that convert, not decoration)

| Idea | Why it converts | Effort |
|---|---|---|
| Command-palette search with instant thumbnails | Removes "can't find it" bounce | M |
| Quick-add + cart drawer with optimistic UI | Cuts clicks to purchase | M |
| Sticky mobile add-to-cart | Mobile is most traffic in TN | S |
| Shoppable video/reels with add-to-cart | Visual proof + impulse buy | M (groundwork exists) |
| Routine / skin-concern quiz → recommended bundle | Guided selling, higher AOV | L |
| Bundles & "frequently bought together" | AOV | M |
| Reviews with photos + verified badge | Trust | M |
| Live "X people viewing / low stock" | Urgency (use honestly) | S |
| Wishlist + back-in-stock | Re-engagement | M |
| WhatsApp order / support button | Preferred channel in Tunisia | S |
| Delivery ETA + COD fee calculator by governorate | Removes checkout anxiety | M |
| Recently viewed rail | Recovery | S |

---

## 7. How we'll know it's working (metrics)

- **Above-the-fold product exposure**: ≥1 buyable product visible without scrolling on home.
- **Add-to-cart rate**: sessions with `add_to_cart` ÷ product-page sessions.
- **Checkout completion**: orders ÷ `begin_checkout`.
- **AOV** and **repeat purchase rate** (tie to Rewards).
- **Broken-link count**: 0 (automate with a link checker in e2e).
- **Time-to-first-product** for a new dev: < 5 minutes, one command.
- Core Web Vitals (LCP/INP) on mobile 4G.

---

## 8. Risks & sequencing notes

- **DB engine switch is the one thing to avoid** while doing this — the existing migration is
  Postgres-specific. Prefer Docker Postgres for dev over swapping to SQLite.
- **Currency migration touches money paths** (carts, orders, transactions). Do Phase 2 behind a
  migration + tests, and do not mix it with the UX refactor.
- **Payload ecommerce plugin is BETA** — pin versions (already pinned to 3.72.0) and keep custom
  checkout logic isolated (already is, in `/api/checkout/cod`).
- **Don't rebuild Payload admin views** unless needed; do storefront work in `(app)`.
- **Interactivity must serve purchase.** Every interactive element should map to one of: find,
  decide, add, pay, return.

---

## 9. Suggested first PR (today, ~1–2 hours of quick wins)

1. Make `ssl` conditional + add `docker-compose.yml` + `pnpm setup` skeleton. (B1–B3)
2. `/products` → `/shop` redirect; fix hero CTAs to `/shop`. (H2, H3)
3. Query real featured/latest products into "Produits Vedettes". (H1)
4. Fix checkout `/search` → `/shop`, and make the header search input functional (navigate to
   `/shop?q=...`). (D1, D3)
5. Write `currency: 'TND'` + use `formatPrice` in the video showcase. (C1–C4)

That single PR removes the two things you complained about (weird setup, no products) and the
most visible trust leaks, without touching the database schema.

---

## Appendix A — Route inventory (current)

Storefront routes: `/`, `/shop`, `/shop/[slug]`, `/products/[slug]`, `/brands/[slug]`,
`/checkout`, `/checkout/confirm-order`, `/create-account`, `/login`, `/logout`,
`/forgot-password`, `/reset-password`, `/verify-email`, `/find-order`, `/rewards`,
`/account`, `/account/addresses`, `/account/rewards`, `/orders`, `/orders/[id]`, `/[slug]` (CMS pages).

**Missing but referenced:** `/products`, `/routines`, `/wishlist`, `/search`, `/contact`, `/faq`,
`/shipping`, `/returns`, `/about`, `/privacy`, `/terms`.

## Appendix B — Key files to touch for Phase 1

- `src/app/(app)/page.tsx` — homepage rebuild
- `src/app/(app)/shop/page.tsx` — listing + filters/sort
- `src/components/Header/index.client.tsx`, `MobileNav.tsx` — search + wishlist
- `src/components/Footer/index.tsx` — links, newsletter, socials
- `src/components/VideoShowcase/index.tsx` — real add-to-cart + TND
- `src/app/api/checkout/cod/route.ts` — currency + auth hardening
- `src/payload.config.ts`, `next.config.js`, `docker-compose.yml`, `scripts/setup.ts` — DX
- `src/globals/SiteSettings.ts` (+ new `HomePage` global) — merchandising controls
