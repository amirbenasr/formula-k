import { tool, type ToolSet } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import { inventoryRows, resolveTargets } from './resolve'
import { money, type AiToolContext, type LooseDoc, type PlannedChange } from './types'

/**
 * Tools exposed to the admin assistant.
 *
 * Read tools run immediately. The one write tool cannot write: it can only
 * create a `pending` AiActionLog row. Applying happens in
 * `/api/admin-ai/apply`, triggered by a human clicking Apply in the chat UI.
 * The model therefore has no code path to mutate the catalogue, regardless of
 * what it is asked or how it is prompted.
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

export function buildTools({ conversationId, payload, user }: AiToolContext): ToolSet {
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
        'Search the product catalogue by title, slug or brand. Returns id, title, slug, price, whether the product uses variants, and its stock (per variant when it has them). Use this to look things up before acting.',
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

        const action = await payload.create(
          asAdmin({
            collection: 'ai-action-logs',
            data: {
              changes,
              conversationId,
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
