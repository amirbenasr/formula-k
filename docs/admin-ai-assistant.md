# AI Admin Assistant

An AI chat panel inside the Payload admin at **`/admin/ai`** that can answer questions
about stock, products, orders and the loyalty programme — and prepare catalogue changes
for a human to approve.

The goal is to remove the manual loop of opening a product, reading a number, typing a new
one and saving, one product at a time.

---

## 1. Architecture

```
/admin/ai                          src/components/AIAssistant/View.tsx   (server, admin-gated)
   │  chat UI, tool cards, Apply button
   ▼
POST /api/admin-ai/chat            src/endpoints/adminAi/chat.ts
   │  requires an admin session
   │  streamText({ tools, stopWhen: isStepCount(8) })
   │  every tool call runs as the signed-in user
   ▼
Payload Local API (Postgres)
   ▲
   │  POST /api/admin-ai/apply      src/endpoints/adminAi/apply.ts
   │  ← the ONLY path that writes to products/variants
   └─ src/lib/ai/apply.ts (single transaction)
```

Key files:

| Path | Role |
| --- | --- |
| `src/lib/ai/provider.ts` | DeepSeek model factory, thinking-mode toggle |
| `src/lib/ai/system-prompt.ts` | Operating instructions, including the write contract |
| `src/lib/ai/resolve.ts` | Variant-aware resolver (see §3) |
| `src/lib/ai/tools.ts` | Tool definitions |
| `src/lib/ai/apply.ts` | Transactional apply + drift detection |
| `src/collections/AiActionLog.ts` | Staging table and audit trail |
| `src/endpoints/adminAi/*` | HTTP surface |
| `src/components/AIAssistant/*` | Admin UI |

---

## 2. The write contract

**The model cannot change your data.** `stage_inventory_update` is the only mutating tool
and it only inserts a `pending` row into `ai-action-logs`. The write happens later, in
`src/lib/ai/apply.ts`, reached only from `/api/admin-ai/apply`, which the **Apply button in
the UI** calls.

This is enforced by the code, not by asking the model nicely in a prompt:

- There is no tool wired to `payload.update` on `products`/`variants`.
- `/api/admin-ai/apply` requires an admin session and refuses any action that is not
  `pending` (409 on replay).
- Applying re-reads current stock first and reports **drift** if the catalogue moved
  between proposal and approval.
- All row updates share one Postgres transaction, because a stock count is one business
  fact — a half-applied count is a state no human intended.
- Every read uses `overrideAccess: false` with the caller's identity, so the assistant can
  never see more than the admin driving it.

Verify it yourself: ask the assistant to set a stock number, then confirm the product is
unchanged and the `ai-action-logs` row says `pending`.

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
| `get_inventory` | Exact stock for one product or variant, with all matches |
| `inventory_report` | Whole-catalogue stock; `lowStockBelow` for restock lists |
| `list_orders` | Recent orders, filtered by status or customer email |
| `order_stats` | Order count and value by status over a window |
| `list_reward_tiers` | Loyalty tiers and thresholds |
| `list_rewards_catalog` | Redeemable rewards and availability |

**Write (staged only)**

| Tool | Purpose |
| --- | --- |
| `stage_inventory_update` | Proposes absolute (`quantity`) or relative (`delta`) stock changes |

---

## 6. Adding a tool

Two rules, both learned the hard way:

1. **Annotate the `execute` parameter.** Destructuring an *optional* field
   (`execute: async ({ limit }) => …`) makes TypeScript infer that field as required, which
   conflicts with the optional inference from `inputSchema`. The tool's generic collapses to
   `never` and `tool()` stops typechecking — even though the runtime code is fine. Always
   write `execute: async ({ limit }: MyToolInput) => …` with the schema hoisted to a `const`.

2. **Route writes through `AiActionLog`.** Do not give a tool direct `update` access. Stage
   a row and extend `src/lib/ai/apply.ts` to handle the new change kind, so the approval
   step and the audit trail keep working.

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

- **Orders and rewards are read-only.** Only stock is writable today.
- **No conversation persistence.** Chat history lives in the browser tab. The durable record
  is `ai-action-logs`.
- **Tool args are validated by zod, not by the provider.** DeepSeek only supports strict
  tool calls on its `/beta` base URL, so malformed arguments are rejected server-side rather
  than upstream.
- **Step cap of 8** per turn (`stopWhen: isStepCount(8)`) to bound a confused model against
  your database.
