# AI Admin Assistant

An AI chat panel inside the Payload admin at **`/admin/ai`** that can answer questions
about stock, products, brands, orders and the loyalty programme — and prepare catalogue
changes (including whole new products) for a human to approve.

The goal is to remove the manual loop of opening a product, reading a number, typing a new
one and saving, one product at a time.

---

## 1. Architecture

```
/admin/ai                          src/components/AIAssistant/View.tsx   (server, admin-gated)
   │  chat UI, operation previews, Apply button
   ▼
POST /api/admin-ai/chat            src/endpoints/adminAi/chat.ts
   │  requires an admin session
   │  streamText({ tools, stopWhen: isStepCount(8) })
   │  every tool call runs as the signed-in user
   ▼
Payload Local API (Postgres)
   ▲
   │  POST /api/admin-ai/apply      src/endpoints/adminAi/apply.ts
   │  ← the ONLY path that writes to products/brands/variants
   └─ src/lib/ai/apply.ts (single transaction, dispatches on AiActionLog.kind)
```

Key files:

| Path | Role |
| --- | --- |
| `src/lib/ai/provider.ts` | DeepSeek model factory, thinking-mode toggle |
| `src/lib/ai/system-prompt.ts` | Operating instructions, including the write contract |
| `src/lib/ai/resolve.ts` | Variant-aware resolver for stock lookups (see §3) |
| `src/lib/ai/validate.ts` | Field normalization and bounds — the rules for what may be written |
| `src/lib/ai/catalogue.ts` | Staging: turns a model request into a validated proposal |
| `src/lib/ai/tools.ts` | Tool definitions |
| `src/lib/ai/apply.ts` | Transactional apply + drift detection |
| `src/collections/AiActionLog.ts` | Staging table and audit trail (`kind` selects the operation) |
| `src/endpoints/adminAi/*` | HTTP surface |
| `src/components/AIAssistant/*` | Admin UI |


---

## 2. The write contract

**The model cannot change your data.** The `stage_*` tools are the only mutating tools, and
they only insert a `pending` row into `ai-action-logs`. The write happens later, in
`src/lib/ai/apply.ts`, reached only from `/api/admin-ai/apply`, which the **Apply button in
the UI** calls.

That single gate now covers three kinds of change, discriminated by `AiActionLog.kind`:

| `kind` | Staged shape | Applied by |
| --- | --- | --- |
| `inventory` | One `PlannedChange` per product/variant row | `applyInventory` — re-reads each row, reports drift, writes new counts |
| `product` | `{ op: create \| update \| publish \| archive, fields, targetId? }` | `applyCatalogue` — creates/updates the product |
| `brand` | `{ op: create \| update, fields, targetId? }` | `applyCatalogue` — creates/updates the brand |

This is enforced by the code, not by asking the model nicely in a prompt:

- There is no tool wired to `payload.create`/`payload.update` on `products` or `brands`.
- `/api/admin-ai/apply` requires an admin session and refuses any action that is not
  `pending` (409 on replay).
- Applying re-reads current state first: stock changes report **drift**, and a create
  re-checks that its slug is still free inside the transaction.
- All row updates share one Postgres transaction, because a staged change is one business
  fact — a half-applied change is a state no human intended.
- The model never supplies raw collection data. Every field is normalized and bounded by
  `src/lib/ai/validate.ts` *before* the proposal is stored, and `apply` writes that
  validated object verbatim.
- Every read uses `overrideAccess: false` with the caller's identity, so the assistant can
  never see more than the admin driving it.

Verify it yourself: ask the assistant to add a product, then confirm the product does not
exist and the `ai-action-logs` row says `pending`.

### Why the approval step was kept

Creating products is the highest-consequence thing the assistant can do, and a create is
not something a diff can undo after the fact. Keeping the proposal/apply split means a
wrong price, a duplicate title or a mis-assigned brand is visible in the chat *before* it
reaches the live catalogue — and every applied change stays auditable.


---

## 3. Why the resolver matters

Inventory lives in **two places** in this schema:

- `Product.inventory` when `enableVariants` is false, and
- `Variant.inventory` — one row per size/shade — when it is true.

`src/lib/ai/resolve.ts` hides that split. It accepts a slug, numeric id, product title, or a
phrase like `"CK Essence 30ml"` and returns concrete rows. When a query matches more than
one row the assistant is instructed to **ask which one** rather than guess, because a wrong
guess silently corrupts a real stock count.

---

## 4. Configuration

Add to `.env`:

```bash
DEEPSEEK_API_KEY=sk-...
AI_MODEL=deepseek-flash     # optional; alias currently serving V4.1 Flash
AI_THINKING=disabled        # optional; see below
```

### Why thinking is disabled

DeepSeek V4-generation models (which includes the `deepseek-flash` alias) enable *thinking*
by default. Inside a tool-calling loop that is actively unhelpful:

- it silently disables `temperature` and `topP` (the API ignores them), and
- it bills reasoning tokens on **every** turn.

DeepSeek's V4 API also requires `reasoning_content` on every assistant turn. This is safe
either way — `@ai-sdk/deepseek` emits `reasoning_content: reasoning ?? ""` for V4 model ids,
so the field is always present — but disabling thinking keeps the loop cheap and
predictable. Set `AI_THINKING=enabled` to opt back in.

---

## 5. Tools

**Read (run immediately)**

| Tool | Purpose |
| --- | --- |
| `find_products` | Search the catalogue by title/slug, with stock and variants |
| `find_brands` | Search brands by title/slug — used to get a brand id before assigning one |
| `get_inventory` | Exact stock for one product or variant, with all matches |
| `inventory_report` | Whole-catalogue stock; `lowStockBelow` for restock lists |
| `list_orders` | Recent orders, filtered by status or customer email |
| `order_stats` | Order count and value by status over a window |
| `list_reward_tiers` | Loyalty tiers and thresholds |
| `list_rewards_catalog` | Redeemable rewards and availability |

**Write (staged only — nothing is written until Apply)**

| Tool | Purpose |
| --- | --- |
| `stage_product_create` | Proposes a new product (title, brand, price, stock, status, …) |
| `stage_product_update` | Proposes edits to an existing product; partial patches |
| `stage_product_publish` | Proposes publishing to the storefront, or moving back to draft |
| `stage_brand_create` | Proposes a new brand (required before a product can reference it) |
| `stage_brand_update` | Proposes brand edits (title, slug, description, logo) |
| `stage_inventory_update` | Proposes absolute (`quantity`) or relative (`delta`) stock changes |

### What the assistant deliberately cannot do

- **Delete** anything. `archive` (`publish: false`) moves a product back to draft, which is
  reversible and already invisible to customers. Removing a row would pull it out of
  historical orders and reports, so it is left to a human in the admin panel.
- **Upload images.** A product created by the assistant has an empty gallery until someone
  adds media, because production media lives in R2 and the assistant has no upload path.
  The system prompt tells it to say so rather than implying the page is finished.
- **Assign variants.** Variant products must be set up in the admin panel; the assistant
  writes `inventory` on simple products only.

### How a product create actually goes through

The model is instructed to check first, so the normal shape is three tool calls where the
first two are reads:

```
find_products "Lip Sleeping Mask EX (Berry) 3g"   → no match
find_brands   "Laneige"                           → id 28
stage_product_create { title, brand: 28, price: 1, inventory: 9, status: 'published' }
                                                  → pending AiActionLog row
                                          ▼
                          human clicks Apply → /api/admin-ai/apply → applyAction
                                          ▼
                     payload.create({ collection: 'products', data: <validated fields> })
```

If the brand does not exist yet, the brand is proposed first and the product has to wait
until that proposal is approved — a product cannot point at a brand id that does not exist.


---

## 6. Adding a tool

Three rules, all learned the hard way:

1. **Annotate the `execute` parameter.** Destructuring an *optional* field
   (`execute: async ({ limit }) => …`) makes TypeScript infer that field as required, which
   conflicts with the optional inference from `inputSchema`. The tool's generic collapses to
   `never` and `tool()` stops typechecking — even though the runtime code is fine. Always
   write `execute: async ({ limit }: MyToolInput) => …` with the schema hoisted to a `const`.

2. **Route writes through `AiActionLog`.** Do not give a tool direct `update` access. Stage
   a row and extend `src/lib/ai/apply.ts` to handle the new change kind, so the approval
   step and the audit trail keep working.

3. **Validate in `validate.ts`, not in the tool.** Field rules live in `PRODUCT_RULES` /
   `BRAND_RULES` so they can be unit-tested without a database, and so apply writes exactly
   the object staging checked. The tool should only translate a model request into
   `stage*()` calls. Note the asymmetry the tests pin down: `price` maps to
   `priceInUSD` **plus** `priceInUSDEnabled: true` (a price without its currency flag is
   invisible in the admin), while `brand` is a single relationship and must be written as a
   number, not an array.

---

## 7. MCP server (not yet enabled)

`@payloadcms/plugin-mcp@3.72.0` is installed and version-matched, and `package.json`
carries a `pnpm.overrides` pin for `@modelcontextprotocol/sdk@^1.26.0` that fixes an upstream
packaging bug in that release (`mcp-handler` imports
`sdk/dist/esm/server/webStandardStreamableHttp.js` without declaring the sdk, and the pinned
`~1.24.0` predates that file).

It is **deliberately not registered** in `src/plugins/index.ts`. Registering it adds a second
auth-enabled collection (`payload-mcp-api-keys`), which widens `req.user` from `User` to:

```ts
(User & { collection: 'users' }) | (PayloadMcpApiKey & { collection: 'payload-mcp-api-keys' })
```

That breaks the type signature of every helper in `src/access/` and the
`src/app/api/rewards/*` routes, because they all assume a single user shape. The plugin adds
the collection **even when `disabled: true`** — by design, so the database schema stays stable
for migrations — so there is no way to register it "off" without the widening.

To enable MCP later, narrow the user by collection first:

```ts
export const adminOnly: Access = ({ req: { user } }) => {
  if (user?.collection !== 'users') return false
  return checkRole(['admin'], user)
}
```

Then register the plugin with `enabled: { find: true }` per collection and flip
`MCP_ENABLED=true`. Prefer read-only: MCP writes would bypass the approval flow in §2.

---

## 8. Known limitations

- **Orders and rewards are read-only.** Products, brands and stock are writable; orders and
  the loyalty programme are not.
- **No delete, and no media upload.** Archive (back to draft) is the assistant's only
  removal, and a created product starts with an empty gallery.
- **No variants.** The assistant sets `inventory` on simple products. Variant products must
  be set up in the admin panel.
- **No conversation persistence.** Chat history lives in the browser tab. The durable record
  is `ai-action-logs`.
- **Tool args are validated by zod, not by the provider.** DeepSeek only supports strict
  tool calls on its `/beta` base URL, so malformed arguments are rejected server-side rather
  than upstream.
- **Step cap of 8** per turn (`stopWhen: isStepCount(8)`) to bound a confused model against
  your database. A brand-then-product sequence fits comfortably; a bulk import does not.

---

## 9. Bulk work outside the chat

For a batch of products the chat is the wrong tool — it caps at 8 steps per turn and asks
for an approval per proposal. Use a script that drives the same library functions instead:

```bash
pnpm create:laneige                    # dry run
pnpm create:laneige --apply            # write
```

`scripts/stock/create-laneige-products.ts` calls `stageProductWrite` / `stageBrandWrite`
and then `applyAction` directly, so it exercises the same validators, the same
`AiActionLog` rows and the same transactional apply as the Apply button. That is the
supported pattern for bulk changes, and it keeps the audit trail intact.
