# Competitor Prices

A **Competitor Prices** tab on the product edit view that searches Google for the product's
title and records what Tunisian shops charge for it, so a price can be judged against the
market instead of in isolation.

The goal is to answer "are we more expensive than everyone else on this serum?" without
opening five tabs and typing prices into a spreadsheet.

---

## 1. Where it lives

```
Product edit view → Competitor Prices tab
   │  [ Check prices ]  +  the saved rows, with our price and the delta
   ▼
POST /api/competitor-prices/fetch      src/endpoints/competitorPrices/fetch.ts
   │  requires an admin session
   │  reads the product as that admin (overrideAccess: false)
   ▼
src/lib/competitorPrices/search.ts     filter → match → parse, one offer per domain
   │
   ▼
src/lib/competitorPrices/serpapi.ts    Google search (Tunisia, French)
   │
   ▼
competitor-prices collection           one row per product × competitor domain, upserted
   ▲
   └─ src/components/admin/CompetitorPrices.tsx reads and writes it over the REST API
```

Key files:

| Path | Role |
| --- | --- |
| `src/lib/competitorPrices/parse.ts` | Price text → dinars, and title → match score. Pure, unit-tested |
| `src/lib/competitorPrices/query.ts` | Product title → the Google query. Pure, unit-tested |
| `src/lib/competitorPrices/search.ts` | Domain allow-list, confidence scoring, one offer per shop |
| `src/lib/competitorPrices/serpapi.ts` | The only file that knows about the search provider |
| `src/lib/competitorPrices/errors.ts` | Failures that read as sentences, with an HTTP status |
| `src/endpoints/competitorPrices/fetch.ts` | HTTP surface + upsert (declared on the collection) |
| `src/collections/CompetitorPrices/index.ts` | Storage |
| `src/components/admin/CompetitorPrices.tsx` | The tab (a `ui` field on products) |

---

## 2. Setup

```
SERPAPI_API_KEY=…            # https://serpapi.com/manage-api-key
```

Without a key the tab still renders and the button reports that lookups are not configured —
nothing else in the app depends on this.

Optional:

| Variable | Default | Meaning |
| --- | --- | --- |
| `COMPETITOR_DOMAINS` | `jumia.com.tn,mytek.tn,tunisianet.com.tn,wiki.tn` | Domains treated as competitors |
| `COMPETITOR_DOMAINS_STRICT` | `false` | `true` accepts only `COMPETITOR_DOMAINS`, instead of any `.tn` host |

Any `*.tn` host is accepted by default, which is what makes the feature work on day one for
the local beauty shops nobody thought to list. Set `COMPETITOR_DOMAINS_STRICT=true` to keep
comparisons to a known set.

SerpAPI's free plan is 100 searches a month; one click on **Check prices** is one search.
Note that Tunisia is poorly covered by Google *Shopping*, which is why this uses the ordinary
web engine and reads the price out of the result snippet instead.

---

## 3. Why parsing is the hard part

Google returns prose, not data, and the obvious implementation is confidently wrong. Three
traps, all handled in `parse.ts`:

**A dinar marker is required.** Product names are mostly numbers — "COSRX Snail 96 Mucin
Power Essence 100ml". A parser that takes the first number it sees reports a competitor price
of `96 DT`. A number only counts as a price when `DT`, `TND` or `dinars` sits within a short
window of it, no foreign currency marker does, and no size unit follows it.

**Three decimals is a millime, not a thousands group.** The dinar divides into 1000 millimes,
so Tunisian shops write `52,500 DT` for 52.5 DT. Reading that as 52 500 DT would be a
spectacular false positive. The same rule already exists in `src/components/admin/tndPrice.ts`,
which is why `parse.ts` imports `roundAmount` from it rather than restating the constant.

**Some prices genuinely read two ways.** `1,250 DT` is 1 250 DT to an English formatter and
1.25 DT to a French one. When we know our own price, the reading within a sane ratio of it
wins; when we do not, the row is stored with `ambiguous` noted.

---

## 4. The query, and why the first one found nothing

The query is built in `query.ts` and looks like what a Tunisian shopper would type:

```
prix Anua Niacinamide Dark Spot Correcting Serum 30ml site:.tn
```

The first version quoted the whole title instead:

```
"Anua – Niacinamide Dark Spot Correcting Serum – 30ml" Anua prix
```

That found almost nothing, and the failure was invisible: the tab reported "no Tunisian shop
listed … with a readable price", which reads like a parsing problem. It was a search problem.
A quoted phrase has to appear **verbatim**, no shop writes a title with those en dashes, and
Google answered with 8 results that were mostly the brand's own pages. The unquoted `.tn`-
restricted form returns 20+ local shops.

Two rules the builder follows:

- **Never quote the title.** Punctuation (dashes, pipes, brackets, accents) is flattened to
  spaces, so `Sérum Éclat — 30ml` searches as `Serum Eclat 30ml`.
- **The `site:` clause must mirror `isCompetitorDomain`.** With the default settings any `.tn`
  host is accepted, so the filter is `site:.tn` — *not* the four domains in
  `COMPETITOR_DOMAINS`, which would silently exclude every other Tunisian shop the
  post-filter would have accepted. Only `COMPETITOR_DOMAINS_STRICT=true` narrows the query to
  the configured list.

**Every rejection is counted.** The response carries the query, the number of results Google
returned, a count per filter (`not Tunisian`, `a different product`, `no readable price`) and
up to five matching listings whose price could not be read. The tab prints the query with an
**open in Google** link and lists those unpriced shops as links, so a thin result set can be
diagnosed — and worked around by hand — instead of guessed at.

If coverage still looks thin, the levers are `num` in `serpapi.ts` (currently 20) and adding
`filter=0` to disable Google's omitted-similar-results filter.

---

## 5. Matching, and what is deliberately not stored

Three filters run in order, and a result has to pass all of them:

1. **A Tunisian shop.** The domain must match `COMPETITOR_DOMAINS` or end in `.tn`.
2. **Our product.** Title similarity (containment, not Jaccard, because competitor titles are
   our title plus noise) must reach 0.25. The score becomes `matchConfidence`:
   `exact` ≥ 0.6, `likely` ≥ 0.4, else `uncertain`.
3. **A readable price.** A dinar amount must be parseable from the title, the snippet or the
   rich snippet.

Only the best offer per domain is kept (closest title first, then cheapest), sorted by price,
capped at 8 — so the table is a comparison, not a dump of Google.

**Rows are never deleted by a lookup.** A shop that this search did not return keeps its old
row and old `fetchedAt`, which is how the tab shows a price is going stale. A row that matched
the wrong product is ticked `ignored` rather than deleted, so the same mistake is not made
twice.

The collection is also the manual back door: search will not find everything, and an admin can
add or correct a row by hand (Content → Competitor Prices).

---

## 6. Security

Custom Payload endpoints are unauthenticated by default, so `/api/competitor-prices/fetch`
checks for an admin session itself and then runs every database call with
`overrideAccess: false` and that user — the same pattern as `/api/admin-ai/chat`. The
collection is `adminOnly` on all four operations, and the React component renders nothing for
a signed-in customer, who can otherwise reach `/admin`.

---

## 7. Not built (yet)

- Per-variant competitor prices.
- Scheduled refreshes and price-drop alerts.
- A chart of a competitor's price over time — `previousPrice` and `priceChangedAt` record the
  last change, not the full history.
- Scraping shops that do not appear in Google. `search.ts` is the seam for that: a second
  provider with the same signature drops in without touching the endpoint or the UI.
