# AI Admin Assistant

An AI chat panel inside the Payload admin at **`/admin/ai`** that can answer questions
about stock, products, brands, orders and the loyalty programme — and prepare catalogue
changes (including whole new products) for a human to approve.

It keeps a saved, GPT-style history: the dashboard greets a signed-in admin with
"How can I help you today?", the sidebar lists past conversations, and reopening one
restores the transcript and its proposal cards (see §6).

The goal is to remove the manual loop of opening a product, reading a number, typing a new
one and saving, one product at a time.

---

## 1. Architecture

```
/admin                            src/components/AIAssistant/DashboardGreeting.tsx
   │  "How can I help you today?" — carries the question to /admin/ai?prompt=…
   ▼
/admin/ai                          src/components/AIAssistant/View.tsx   (server, admin-gated)
   │  conversation sidebar + chat UI + operation previews + Apply button
   ▼
POST /api/admin-ai/chat            src/endpoints/adminAi/chat.ts
   │  requires an admin session
   │  persists the transcript (before the model call and again on stream end)
   │  streamText({ tools, stopWhen: isStepCount(8) })
   │  every tool call runs as the signed-in user
   ▼
Payload Local API (Postgres)
   ▲
   │  POST /api/admin-ai/apply      src/endpoints/adminAi/apply.ts
   │  ← the ONLY path that writes to products/brands/variants
   └─ src/lib/ai/apply.ts (single transaction, dispatches on AiActionLog.kind)

GET/PATCH/DELETE /api/admin-ai/conversations[/:key]
   └─ src/lib/ai/conversations.ts (owner-scoped persistence, title/preview, action statuses)
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
| `src/lib/ai/conversation-text.ts` | Pure title/preview/key rules (unit-tested) |
| `src/lib/ai/conversations.ts` | Conversation persistence, ownership, action statuses |
| `src/collections/AiActionLog.ts` | Staging table and audit trail (`kind` selects the operation) |
| `src/collections/AiConversations.ts` | Chat history table (hidden from the admin nav) |
| `src/endpoints/adminAi/*` | HTTP surface |
| `src/components/AIAssistant/*` | Admin UI (dashboard greeting, sidebar, chat, markdown) |


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

# Web image search (tier 2 of §5a), using Google Images via SerpAPI.
IMAGE_SEARCH_PROVIDER=serpapi   # serpapi | none
# SERPAPI_TIMEOUT_MS=90000      # per-attempt ceiling; a cold search takes ~60s
```

`SERPAPI_API_KEY` is the same key the competitor-price lookup uses — image search adds no
new vendor or credential. `IMAGE_SEARCH_PROVIDER=none` makes `search_web_images` return an
explanatory note instead of searching, which is the right setting if you want product images
to come only from the media library or an explicit upload.

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
| `find_media` | Rank the store's existing images against a product name (0–1 scores) |
| `search_web_images` | Find candidate photos on the web, openly licensed only |
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
| `stage_product_images` | Proposes the primary image, an append, or a gallery replace |
| `stage_brand_create` | Proposes a new brand (required before a product can reference it) |
| `stage_brand_update` | Proposes brand edits (title, slug, description, logo) |
| `stage_inventory_update` | Proposes absolute (`quantity`) or relative (`delta`) stock changes |

### What the assistant deliberately cannot do

- **Delete** anything. `archive` (`publish: false`) moves a product back to draft, which is
  reversible and already invisible to customers. Removing a row would pull it out of
  historical orders and reports, so it is left to a human in the admin panel.
- **See images.** DeepSeek is text-only, so the assistant cannot look at a photo, judge its
  quality, or compare two candidates. It moves ids and URLs around; a human reviews the
  thumbnails in the proposal. See §5a for how images are resolved.
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

### 5a. How images are resolved

The assistant cannot receive image bytes, so an image is always resolved to a **media id**
before it touches a product. Resolution walks four tiers, cheapest and safest first. The
order is enforced by the tools plus the system prompt, not by luck:

| Tier | Source | Cost | What it means |
| --- | --- | --- | --- |
| 0 | Attached in the chat | free | The admin picked the file. Uploaded immediately, id passed to the model |
| 1 | `find_media` (own library) | free | Already licensed, usually the brand's own packshot. Score ≥ 0.6 is a real match |
| 2 | `search_web_images` | 1 search | Google Images via SerpAPI — the brand's packshot, or a retailer's photo |
| — | Never | — | The model may not invent a URL. Only ids from tier 0/1, or URLs returned by tier 2 |

**Tier 0 — attachment.** `Chat.tsx` posts the file to Payload's own `/api/media` endpoint
(multipart `file` + `alt`; `alt` is required by the collection). It waits for the JSON
response, then appends a `[attached media id=42 alt="…"]` marker to the message. The marker
is stripped from the rendered bubble but kept in the stored message, because it is how the
model learns which image "this one" refers to. The image is never sent to DeepSeek.

**Tier 1 — the library.** `find_media` fetches the 200 most recent media rows and scores
them in JS: exact alt text (1.0), exact filename (0.95), whole-word containment (0.9), then
token coverage with prefix matches at 0.8. Postgres `contains` alone cannot match "anua
toner" against "Anua Heartleaf 77% Soothing Toner 250ml", which is why the scoring is fuzzy
and why it is unit-tested without a database.

**Tier 2 — the web.** `engine=google_images` through SerpAPI, reusing `SERPAPI_API_KEY`, so
no new vendor. Each result carries two URLs, and both matter:

- `original` — the direct image on the source's own CDN. This is what we want, and what gets
  downloaded first.
- `thumbnail` — SerpAPI's own copy, kept as `fallbackUrl` because retail CDNs commonly refuse
  a request that does not look like a browser on their page.

Results also carry `source` (stored as `credit`), `link` (the page, sent as `Referer` and
recorded as `sourceUrl`), `original_width`/`original_height` and `is_product`. Anything with
no `original`, or an `original` under 300px, is dropped at parse time — a thumbnail cannot
become a product's primary image.

> **Why not a Creative Commons corpus.** The first version of this used Openverse with
> Wikimedia Commons as fallback. It was removed because those corpora do not contain branded
> beauty or household products: "anua heartleaf toner bottle" returned zero results, and
> "serum bottle" returned a blood-transfusion painting and a pig-cholera plant. No query
> tuning fixes a corpus with the wrong contents. Google Images returns the brand's own
> packshots, which is the only thing useful to a store that resells those products.

**Licence.** These are third-party copyrighted photos, not licensed stock. SerpAPI can filter
to freely licensed images (`licenses=fc`), but that discards the brand packshots and leaves
generic stock — defeating the purpose. The trade made instead: provenance is recorded on
every media row (`source`, `sourceUrl`, `credit`), the approval panel shows it, and a human
approves each image. Confirming the store may publish a given photo is the admin's call.

**Downloading** is defensive, because the URL is model-influenced: only public http(s) is
allowed (loopback, private ranges and link-local metadata endpoints are rejected before and
after redirects), content must be `image/*` under 10 MB, and the bytes must decode through
`sharp` before they reach storage. The download is a ladder — `original` with a browser
user-agent and a `Referer` of the result page, then `fallbackUrl`, then a `problems[]` entry
the model can report. The storage plugin decides where the bytes land — R2 when `R2_*` is
valid, `public/media` otherwise — so `payload.create` is the only writer.

**Provenance.** Web-sourced media rows carry `source: 'web'`, the origin page in `sourceUrl`,
and the source site in `credit`. Without those three fields a web photo is indistinguishable
from a real product photo, and nobody can answer "where did this come from, and may we use
it?" months later.

**Cost.** One SerpAPI search per lookup, and SerpAPI serves an identical query from its cache
for an hour, which is free and does not count against the quota.

**Timing — the bug worth knowing about.** A *cold* Google Images search takes SerpAPI about a
minute (measured: 61.53s); a cached one takes about a second. The first version of this used a
20s timeout, so **every cold search aborted while SerpAPI went on to finish it and record a
success** — the chat reported "the provider timed out" for a search that had actually worked,
and the model then "narrowed" the query, starting a second minute-long cold search.

Now: the timeout is 90s (`SERPAPI_TIMEOUT_MS` overrides it), and a timeout triggers **one
identical retry**. That retry is the point — SerpAPI caches the finished search, so the same
query comes back almost instantly and for free. A different query would be another cold
search, which is why the prompt tells the model to retry the *same* query and never to
shorten or reword it.

The UI shows "Thinking…" for that minute, which is expected. Vercel allows up to 5 minutes for
the invocation.

**When the media row is created.** Web images are downloaded and inserted at *staging* time,
not on Apply: the approval panel has to show the actual picture (approving "some URL" blind
would defeat the review step), and a network call inside `applyAction`'s transaction would
hold a database transaction open across a remote fetch. The trade-off is that rejecting a
proposal leaves an unused, correctly-credited media row in the library.

**Gallery shape.** `products.gallery` is an **array of `{ image, variantOption }`** objects,
not a `hasMany` upload list. The model supplies ordered media ids; `validate.ts` maps them to
rows and carries each image's `variantOption` across, so reordering does not quietly unbind a
variant product's per-variant pictures. The storefront primary image is simply `gallery[0]`,
which is why `stage_product_images` has a distinct `set_primary` mode instead of asking the
model to re-send the whole list.

### 5b. Diagnosing a failed turn

**The request log is not enough.** `/api/admin-ai/chat` streams, so the endpoint returns `200`
the moment the stream opens and stays open while the tool loop runs. A turn where every search
failed still shows as `200` in Vercel's request list. The useful record is the console output,
which Vercel keeps per deployment:

- Vercel dashboard → the project → **Logs** (or `vercel logs <deployment-url>`), then filter on
  `[ai/chat]` or `[ai/search-images]`.

Three line families, deliberately greppable:

| Line | Answers |
| --- | --- |
| `[ai/chat] start conversation=… messages=N` | Did the turn start, and with how much context? |
| `[ai/chat] tool=find_media args={…} conversation=…` | Which tool ran, with what arguments — this is the actual decision trace |
| `[ai/chat] done conversation=… elapsed=…ms` | How long the whole turn took |
| `[ai/search-images] ok query="…" attempt=1 elapsed=61250ms candidates=12` | The search worked; note the elapsed time and how many candidates parsed |
| `[ai/search-images] fail query="…" attempt=2 elapsed=20001ms timedOut=true status=- — timed out after 20s` | The search failed, and **why**: timeout vs HTTP vs provider error |

Reading a failure, in order:

1. `timedOut=true` and `elapsed` near the timeout → the provider is slow. SerpAPI's dashboard
   (below) will usually show the search as **Success** with its own `Time Taken`, because it
   finished after we stopped waiting. Both are true; ours is the client's view.
2. `status=401` / `status=429` → key or quota, not a search problem.
3. `candidates=0` on an `ok` line → the search worked but the payload had no usable image
   (no `original`, or under 300px). The note says so.
4. No `[ai/search-images]` line at all → the model never called the tool; the prompt or the
   conversation is the issue.

**Provider side.** serpapi.com → Dashboard → Searches lists every call with `Q`, `Status`,
`Time Taken`, the search id and a `Json Endpoint`. The `q` there is the same string logged in
`[ai/search-images]`, which is how you correlate the two when a search is slow.

---

## 6. Conversation history

The assistant keeps a GPT-style history: the sidebar lists past chats, opening
one restores the full transcript (including tool calls and proposal cards), and a
turn survives a refresh, a closed tab or a provider failure.

### Storage

`ai-conversations` holds one row per conversation:

| Column | Meaning |
| --- | --- |
| `key` | The client-generated UUID shared by `useChat` and `AiActionLog.conversationId` (unique) |
| `owner` | The admin who owns the chat |
| `title` | Derived from the first user message; renamable from the sidebar |
| `preview` | Last text in the transcript, shown under the title |
| `messages` | The AI SDK `UIMessage[]` transcript, as JSON |
| `messageCount`, `lastMessageAt` | Cheap sorting/grouping without reading the JSON |

The transcript is stored in the exact shape `useChat` consumes, so reopening a
chat is `useChat({ messages })` — there is no second schema or part graph to keep
in sync. Tool calls, their validated outputs and the staged proposal cards are
therefore restored verbatim.

The collection is `admin.hidden`, because the chat sidebar is the interface; the
table would otherwise put raw transcript JSON one click from an accidental edit.
It remains queryable through the Local API and the endpoints below.

### Ownership

A conversation is personal. `src/lib/ai/conversations.ts` filters every read by
`owner = req.user.id` and additionally refuses a row whose owner is somebody else,
so the chat endpoint can never append to another admin's history. The collection's
access rules mirror that: admins may read all rows for audit, but rename and
delete are owner-only. Conversation ids are never accepted as proof of access.

### When a turn is written

`/api/admin-ai/chat` writes twice:

1. **On arrival**, with the admin's messages. If DeepSeek is down, the API key is
   missing or the tab closes mid-turn, the question is still in their history.
2. **In the UI stream's `onEnd`**, with the assistant reply and tool outputs. This
   runs while the stream is still owned by the request, not racing Response
   completion.

If a follow-up turn persists before the previous stream's `onEnd` finishes, the
older, shorter transcript is discarded (`messageCount > messages.length` guard),
so a slow write cannot delete the newest question.

Aborted streams still save what was streamed, which is why an interrupted answer
can be reopened and read up to the point of interruption.

### Title and preview

`src/lib/ai/conversation-text.ts` derives both, as pure functions with unit tests:

- The title is the first user message, cut to the first sentence and then a word
  boundary (70 chars). The `[attached media …]` note is stripped, so an
  attachment-only turn becomes "Image attachment".
- The preview is the most recent user/assistant text, collapsed to one line
  (160 chars).
- A rename is never overwritten: only the placeholder title is ever replaced.

### HTTP surface

All routes require an admin session (same guard as the chat):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin-ai/conversations?limit=100&search=` | Sidebar list, newest first |
| `GET` | `/api/admin-ai/conversations/:key` | Transcript + proposals for one chat |
| `PATCH` | `/api/admin-ai/conversations/:key` | Rename (`{ title }`) |
| `DELETE` | `/api/admin-ai/conversations/:key` | Delete the history row |

`GET /:key` also returns `actions: [{ actionId, status, summary, appliedAt, error }]`
for every `AiActionLog` row raised in that chat. The UI uses it to render an
applied proposal as **Applied** instead of showing the Apply button again — a
replay would be rejected with `409` by `/api/admin-ai/apply`, so the correct state
is "already done", not "click me again". Deleting a conversation deliberately does
not delete its action rows: those are the audit trail, and they remain visible in
the **AI Action Logs** collection.

### Dashboard entry point

`src/components/AIAssistant/DashboardGreeting.tsx` replaces the template
boilerplate on the admin dashboard. It greets the signed-in admin by name, carries
a question to `/admin/ai?prompt=…` (auto-sent once the chat mounts), lists the four
most recent chats, and links to the full assistant. The prompt is removed from the
URL as soon as it is consumed, so a refresh starts a clean chat rather than
re-asking the same question.

### Responsive layout

The assistant is a two-pane layout on desktop and a drawer + full-width chat at
1024px and below. The composer keeps Enter-to-send / Shift+Enter for a newline,
grows to 180px, offers Stop while streaming, and the transcript only auto-scrolls
while the reader is already at the bottom.

---

## 7. Adding a tool

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
   `stage*()` calls. Note the asymmetries the tests pin down: `price` maps to
   `priceInUSD` **plus** `priceInUSDEnabled: true` (a price without its currency flag is
   invisible in the admin), `brand` is a single relationship and must be written as a
   number, not an array — and `gallery` is the reverse, an array of `{ image, variantOption }`
   rows, so the model's ordered media ids are mapped rather than passed through.

---

## 8. MCP server (not yet enabled)

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

## 9. Known limitations

- **Orders and rewards are read-only.** Products, brands and stock are writable; orders and
  the loyalty programme are not.
- **No delete.** Archive (back to draft) is the assistant's only removal.
- **Images are chosen blind.** The assistant can attach, promote and reorder images, but it
  cannot see them, so it cannot tell a good photo from a bad one — a human reviews the
  thumbnails in the proposal. Web-sourced images (§5a) are generic and often the wrong
  product; the library and an upload are the reliable paths.
- **No variants.** The assistant sets `inventory` on simple products. Variant products must
  be set up in the admin panel.
- **Conversations are personal.** Each admin sees their own chats; there is no shared team
  thread. An admin can read another admin's rows through the API for audit, but not post to
  them or rename them.
- **Titles are heuristic.** The first user message is used (first sentence, word-boundary
  truncation), not a model-generated summary. Rename from the sidebar if that is not enough.
- **Deleting a chat does not delete its proposals.** `ai-action-logs` is the audit trail and
  survives the conversation; use the log's status (or the Apply flow) to close a proposal out.
- **Tool args are validated by zod, not by the provider.** DeepSeek only supports strict
  tool calls on its `/beta` base URL, so malformed arguments are rejected server-side rather
  than upstream.
- **Step cap of 8** per turn (`stopWhen: isStepCount(8)`) to bound a confused model against
  your database. A brand-then-product sequence fits comfortably; a bulk import does not.

---

## 10. Bulk work outside the chat

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
