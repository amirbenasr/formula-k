import { tool, type ToolSet } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import {
  stageBrandWrite,
  stageProductStatus,
  stageProductWrite,
} from './catalogue'
import { inventoryRows, resolveTargets } from './resolve'
import type { AiToolContext, LooseDoc, PlannedChange, StagedWrite } from './types'
import { money } from './types'

/**
 * Tools exposed to the admin assistant.
 *
 * Read tools run immediately. The write tools cannot write: each one only
 * creates a `pending` AiActionLog row holding an already-validated change.
 * Applying happens in `/api/admin-ai/apply`, triggered by a human clicking Apply
 * in the chat UI. The model therefore has no code path to mutate the catalogue,
 * regardless of what it is asked or how it is prompted — which is what lets it
 * create products and flip publish state without the risk of an unreviewed live
 * change.
 *
 * NOTE ON THE SCHEMA/execute PATTERN
 * Every `execute` parameter is explicitly annotated with the schema's inferred
 * type. Without the annotation, destructuring an *optional* field (e.g.
 * `{ limit }`) makes TypeScript infer that field as required, which conflicts
 * with the optional inference coming from `inputSchema`. The two candidate
 * inferences collapse the tool's generic to `never` and `tool()` fails to
 * typecheck. So: `execute: async ({ limit }: FindProductsInput) => ...`, never
 * a bare destructure.
 */

const findProductsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('Max products to return (default 10)'),
  lowStockBelow: z
    .number()
    .int()
    .optional()
    .describe('Only return rows whose stock is at or below this number'),
  query: z.string().optional().describe('Text to match against product title or slug'),
})
type FindProductsInput = z.infer<typeof findProductsSchema>

const findBrandsSchema = z.object({
  query: z.string().optional().describe('Text to match against brand title or slug'),
})
type FindBrandsInput = z.infer<typeof findBrandsSchema>

const getInventorySchema = z.object({
  query: z.string().describe('Product slug, id, title, or "product option" phrase'),
})
type GetInventoryInput = z.infer<typeof getInventorySchema>

const inventoryReportSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().describe('Max rows to return (default 50)'),
  lowStockBelow: z.number().int().optional().describe('Only rows at or below this stock level'),
})
type InventoryReportInput = z.infer<typeof inventoryReportSchema>

const listOrdersSchema = z.object({
  customerEmail: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().describe('Default 10'),
  status: z.enum(['processing', 'completed', 'cancelled', 'refunded']).optional(),
})
type ListOrdersInput = z.infer<typeof listOrdersSchema>

const orderStatsSchema = z.object({
  sinceDays: z.number().int().min(1).max(365).optional().describe('Look-back window in days (default 30)'),
})
type OrderStatsInput = z.infer<typeof orderStatsSchema>

const emptySchema = z.object({})
type EmptyInput = z.infer<typeof emptySchema>

const rewardsCatalogSchema = z.object({
  activeOnly: z.boolean().optional().describe('Default true'),
})
type RewardsCatalogInput = z.infer<typeof rewardsCatalogSchema>

const stageInventorySchema = z.object({
  note: z.string().optional().describe('Why this change is being made'),
  updates: z
    .array(
      z.object({
        delta: z.number().int().optional().describe('Relative change, e.g. -2 or 5'),
        quantity: z.number().int().min(0).optional().describe('Absolute new stock count'),
        query: z.string().describe('Product slug, id, title, or "product option" phrase'),
      }),
    )
    .min(1),
})
type StageInventoryInput = z.infer<typeof stageInventorySchema>

/**
 * The writable product surface.
 *
 * `price` is a single number rather than the plugin's `priceInUSD` /
 * `priceInUSDEnabled` pair, and the tool maps it: a model that had to set the
 * currency flag would eventually forget it and write an invisible price.
 */
const productFieldsSchema = z.object({
  brand: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Brand id (number). Look it up with find_brands; create it with stage_brand_create.'),
  categories: z.array(z.number().int().positive()).optional().describe('Category ids'),
  description: z
    .string()
    .optional()
    .describe('Plain text. Blank lines become paragraphs; lines starting with "- " or "1. " become lists.'),
  featuredInVideoShowcase: z.boolean().optional(),
  gallery: z.array(z.number().int().positive()).optional().describe('Media ids'),
  inventory: z.number().int().min(0).optional().describe('Stock count for a simple (non-variant) product'),
  price: z
    .number()
    .min(0)
    .optional()
    .describe('Selling price as a number, e.g. 1 for 1.00. Writes both the amount and its currency flag.'),
  slug: z.string().optional().describe('URL slug. Derived from the title when omitted.'),
  status: z
    .enum(['draft', 'published'])
    .optional()
    .describe('"published" makes the product visible on the storefront.'),
  title: z.string().optional(),
})
const stageProductCreateSchema = z.object({
  note: z.string().optional().describe('Why this product is being added'),
  product: productFieldsSchema.describe('The product to create'),
})
type StageProductCreateInput = z.infer<typeof stageProductCreateSchema>

const stageProductUpdateSchema = z.object({
  id: z.string().describe('Product id, slug or title to update'),
  note: z.string().optional(),
  product: productFieldsSchema.describe('Only the fields that should change'),
})
type StageProductUpdateInput = z.infer<typeof stageProductUpdateSchema>

const stageProductPublishSchema = z.object({
  id: z.string().describe('Product id, slug or title'),
  note: z.string().optional(),
  publish: z
    .boolean()
    .describe('true publishes to the storefront; false moves it back to draft (hides it, nothing is deleted)'),
})
type StageProductPublishInput = z.infer<typeof stageProductPublishSchema>

const stageBrandWriteSchema = z.object({
  brand: z
    .object({
      description: z.string().optional(),
      logo: z.number().int().positive().optional().describe('Media id'),
      slug: z.string().optional().describe('Derived from the title when omitted'),
      title: z.string().optional(),
    })
    .describe('Brand fields'),
  id: z
    .string()
    .optional()
    .describe('Omit to create a new brand; pass a brand id, slug or title to edit an existing one'),
  note: z.string().optional(),
})
type StageBrandWriteInput = z.infer<typeof stageBrandWriteSchema>

export function buildTools({ conversationId, payload, user }: AiToolContext): ToolSet {
  const context: AiToolContext = { conversationId, payload, user }

  /** All reads run as the logged-in admin, never with elevated access. */
  const asAdmin = <T extends Record<string, unknown>>(
    args: T,
  ): T & { overrideAccess: false; user: typeof user } => ({
    ...args,
    overrideAccess: false,
    user,
  })

  return {
    find_products: tool({
      description:
        'Search the product catalogue by title, slug or brand. Returns id, title, slug, price, whether the product uses variants, and its stock (per variant when it has them). ALWAYS use this before creating a product, so you do not add a duplicate.',
      inputSchema: findProductsSchema,
      execute: async ({ limit = 10, lowStockBelow, query }: FindProductsInput) => {
        const where: Where = query
          ? { or: [{ title: { contains: query } }, { slug: { contains: query } }] }
          : {}

        const { docs } = await payload.find(
          asAdmin({
            collection: 'products',
            depth: 0,
            limit,
            sort: 'title',
            where,
          }),
        )

        const rows: Record<string, unknown>[] = []

        for (const product of docs as LooseDoc[]) {
          const targets = await resolveTargets(payload, product.slug ?? String(product.id), 50)

          const variants = targets
            .filter(
              (target) => target.productId === product.id && target.kind === 'variant',
            )
            .map((target) => ({
              inventory: target.inventory,
              options: target.variantOptions,
              variantId: target.variantId,
            }))

          const stock =
            product.enableVariants === true
              ? variants.reduce((sum, variant) => sum + variant.inventory, 0)
              : (targets.find((target) => target.kind === 'product')?.inventory ?? 0)

          if (typeof lowStockBelow === 'number' && stock > lowStockBelow) continue

          rows.push({
            enableVariants: product.enableVariants === true,
            id: product.id,
            inventory: stock,
            price: money(product.priceInUSD),
            slug: product.slug,
            status: product._status,
            title: product.title,
            variants: variants.length > 0 ? variants : undefined,
          })
        }

        return { count: rows.length, products: rows }
      },
    }),

    find_brands: tool({
      description:
        'Search brands by title or slug. Use this to get a brand id before assigning it to a product, and to check whether a brand already exists before creating one.',
      inputSchema: findBrandsSchema,
      execute: async ({ query }: FindBrandsInput) => {
        const where: Where = query
          ? { or: [{ title: { contains: query } }, { slug: { contains: query } }] }
          : {}

        const { docs } = await payload.find(
          asAdmin({
            collection: 'brands',
            depth: 0,
            limit: 50,
            sort: 'title',
            where,
          }),
        )

        return {
          brands: (docs as LooseDoc[]).map((brand) => ({
            id: brand.id,
            slug: brand.slug,
            title: brand.title,
          })),
          count: docs.length,
        }
      },
    }),

    get_inventory: tool({
      description:
        'Get the exact stock level for a specific product or variant. Accepts a slug, numeric id, product title, or a phrase like "CK Essence 30ml". Returns every match with its stock so you can disambiguate. Always call this before proposing a stock change.',
      inputSchema: getInventorySchema,
      execute: async ({ query }: GetInventoryInput) => {
        const targets = await resolveTargets(payload, query)

        if (targets.length === 0) {
          return { found: false, matches: [], message: `No product or variant matched "${query}".` }
        }

        return {
          found: true,
          matches: targets.map((target) => ({
            currentStock: target.inventory,
            kind: target.kind,
            label: target.label,
            productId: target.productId,
            slug: target.slug,
            variantId: target.variantId,
          })),
        }
      },
    }),

    inventory_report: tool({
      description:
        'List stock across the whole catalogue. Use lowStockBelow to find items that need restocking. This is the tool for "what is running low?" or "show me all stock".',
      inputSchema: inventoryReportSchema,
      execute: async ({ limit = 50, lowStockBelow }: InventoryReportInput) => {
        const rows = await inventoryRows(payload, lowStockBelow)
        const totalUnits = rows.reduce((sum, row) => sum + row.inventory, 0)

        return {
          lowStockBelow: lowStockBelow ?? null,
          returned: Math.min(rows.length, limit),
          rows: rows.slice(0, limit).map((row) => ({
            kind: row.kind,
            label: row.label,
            productId: row.productId,
            slug: row.slug,
            stock: row.inventory,
            variantId: row.variantId,
          })),
          totalRows: rows.length,
          totalUnits,
        }
      },
    }),

    list_orders: tool({
      description: 'List recent orders, optionally filtered by status or customer email.',
      inputSchema: listOrdersSchema,
      execute: async ({ customerEmail, limit = 10, status }: ListOrdersInput) => {
        const conditions: Where[] = []
        if (status) conditions.push({ status: { equals: status } })
        if (customerEmail) conditions.push({ customerEmail: { equals: customerEmail } })

        const where: Where = conditions.length > 0 ? { and: conditions } : {}

        const { docs, totalDocs } = await payload.find(
          asAdmin({
            collection: 'orders',
            depth: 0,
            limit,
            sort: '-createdAt',
            where,
          }),
        )

        return {
          orders: (docs as LooseDoc[]).map((order) => ({
            amount: money(order.amount),
            createdAt: order.createdAt,
            customerEmail: order.customerEmail,
            id: order.id,
            itemCount: Array.isArray(order.items) ? order.items.length : 0,
            status: order.status,
          })),
          totalDocs,
        }
      },
    }),

    order_stats: tool({
      description:
        'Summarise orders over a recent window: count and total value broken down by status. Use for questions like "how did we do this week?".',
      inputSchema: orderStatsSchema,
      execute: async ({ sinceDays = 30 }: OrderStatsInput) => {
        const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

        const { docs } = await payload.find(
          asAdmin({
            collection: 'orders',
            depth: 0,
            limit: 1000,
            pagination: false,
            where: { createdAt: { greater_than: since } },
          }),
        )

        const byStatus: Record<string, { count: number; value: number }> = {}

        for (const order of docs as LooseDoc[]) {
          const key = order.status ?? 'unknown'
          byStatus[key] ??= { count: 0, value: 0 }
          byStatus[key].count += 1
          byStatus[key].value += typeof order.amount === 'number' ? order.amount : 0
        }

        return {
          byStatus: Object.fromEntries(
            Object.entries(byStatus).map(([key, entry]) => [
              key,
              { count: entry.count, value: money(entry.value) },
            ]),
          ),
          sinceDays,
          totalOrders: docs.length,
        }
      },
    }),

    list_reward_tiers: tool({
      description: 'List the loyalty reward tiers, their point thresholds and multipliers.',
      inputSchema: emptySchema,
      execute: async (_input: EmptyInput) => {
        const { docs } = await payload.find(
          asAdmin({
            collection: 'reward-tiers',
            depth: 0,
            limit: 100,
            pagination: false,
            sort: 'order',
          }),
        )

        return {
          tiers: (docs as LooseDoc[]).map((tier) => ({
            id: tier.id,
            minPoints: tier.minPoints,
            multiplier: tier.pointsMultiplier,
            name: tier.name,
            slug: tier.slug,
          })),
        }
      },
    }),

    list_rewards_catalog: tool({
      description: 'List rewards customers can redeem, with point cost and availability.',
      inputSchema: rewardsCatalogSchema,
      execute: async ({ activeOnly = true }: RewardsCatalogInput) => {
        const where: Where = activeOnly ? { isActive: { equals: true } } : {}

        const { docs } = await payload.find(
          asAdmin({
            collection: 'rewards-catalog',
            depth: 0,
            limit: 100,
            pagination: false,
            where,
          }),
        )

        return {
          rewards: (docs as LooseDoc[]).map((reward) => ({
            id: reward.id,
            isActive: reward.isActive,
            name: reward.name,
            pointsCost: reward.pointsCost,
            totalAvailable: reward.totalAvailable,
            totalRedeemed: reward.totalRedeemed,
            type: reward.type,
          })),
        }
      },
    }),

    stage_product_create: tool({
      description:
        'Propose a NEW product. Does not create anything by itself — it records a pending action the admin approves. Call find_products first to prove the product does not already exist, and find_brands to get the brand id (brand is required). Supply `price` as a plain number and `status: "published"` if it should be visible on the storefront immediately.',
      inputSchema: stageProductCreateSchema,
      execute: async ({ product }: StageProductCreateInput) =>
        stageProductWrite(context, { product }),
    }),

    stage_product_update: tool({
      description:
        'Propose an EDIT to an existing product (price, title, stock, description, brand, visibility…). Does not write anything by itself — the admin approves it. Pass only the fields that should change. Identify the product with its numeric id or its slug.',
      inputSchema: stageProductUpdateSchema,
      execute: async ({ id, product }: StageProductUpdateInput) =>
        stageProductWrite(context, { id, product }),
    }),

    stage_product_publish: tool({
      description:
        'Propose making a product visible on the storefront (`publish: true`) or hiding it again (`publish: false`, back to draft). Nothing is deleted. Does not write anything by itself — the admin approves it.',
      inputSchema: stageProductPublishSchema,
      execute: async ({ id, publish }: StageProductPublishInput) =>
        stageProductStatus(context, { id, publish }),
    }),

    stage_brand_create: tool({
      description:
        'Propose a NEW brand. Does not create anything by itself — the admin approves it. Call find_brands first so you do not propose a duplicate. Products can only be assigned brands that already exist.',
      inputSchema: stageBrandWriteSchema,
      execute: async ({ brand }: StageBrandWriteInput) =>
        stageBrandWrite(context, { brand }),
    }),

    stage_brand_update: tool({
      description:
        'Propose an EDIT to an existing brand (title, slug, description, logo). Does not write anything by itself — the admin approves it.',
      inputSchema: stageBrandWriteSchema,
      execute: async ({ brand, id }: StageBrandWriteInput) =>
        stageBrandWrite(context, { brand, id }),
    }),

    stage_inventory_update: tool({
      description:
        'Propose a stock change. This does NOT change anything by itself — it records a pending action that the admin must approve in the UI. Provide either `quantity` (absolute new count) or `delta` (relative change) for each item. Always call get_inventory first and confirm the match when a query is ambiguous.',
      inputSchema: stageInventorySchema,
      execute: async ({ note, updates }: StageInventoryInput) => {
        const changes: PlannedChange[] = []
        const problems: string[] = []

        for (const update of updates) {
          if (update.quantity === undefined && update.delta === undefined) {
            problems.push(`"${update.query}": provide either quantity or delta.`)
            continue
          }

          const targets = await resolveTargets(payload, update.query)

          if (targets.length === 0) {
            problems.push(`"${update.query}": no product or variant matched.`)
            continue
          }

          if (targets.length > 1) {
            problems.push(
              `"${update.query}": ambiguous, matched ${targets.length} rows (${targets
                .map((target) => target.label)
                .join('; ')}). Ask the admin which one, or use the variant id.`,
            )
            continue
          }

          const target = targets[0]
          const to = update.quantity ?? target.inventory + (update.delta ?? 0)

          if (to < 0) {
            problems.push(
              `"${update.query}": would result in negative stock (${target.inventory} + ${update.delta}).`,
            )
            continue
          }

          changes.push({
            from: target.inventory,
            label: target.label,
            productId: target.productId,
            targetId: target.kind === 'variant' ? (target.variantId as number) : target.productId,
            targetKind: target.kind,
            to,
          })
        }

        if (changes.length === 0) {
          return { problems, staged: false }
        }

        const summary =
          note ??
          `${changes.length} stock update${changes.length === 1 ? '' : 's'}: ${changes
            .map((change) => `${change.label} ${change.from}→${change.to}`)
            .join(', ')}`

        const write: StagedWrite = { changes, targetKind: 'inventory' }

        const action = await payload.create(
          asAdmin({
            collection: 'ai-action-logs',
            data: {
              changes: write,
              conversationId,
              kind: 'inventory',
              requestedBy: user.id,
              status: 'pending',
              summary,
              toolName: 'stage_inventory_update',
            },
            depth: 0,
          }),
        )

        return {
          actionId: action.id,
          changes,
          problems: problems.length > 0 ? problems : undefined,
          staged: true,
          summary,
        }
      },
    }),
  }
}
