import type { Payload } from 'payload'

import type { LooseDoc } from './types'

/**
 * Inventory lives in two different places in this schema, and that split is the
 * single biggest source of manual editing:
 *
 *  - `Product.inventory` when the product has variants disabled, and
 *  - `Variant.inventory` (one row per size/shade) when they are enabled.
 *
 * Everything the assistant does goes through this resolver so the model never
 * has to know which of the two it is looking at, and so "CK Essence 30ml"
 * resolves to the same row a human would pick.
 */
export type ResolvedTarget = {
  /** Human label used in the diff shown to the admin. */
  label: string
  inventory: number
  kind: 'product' | 'variant'
  productId: number
  productTitle: string
  slug: string
  /** Present only for `kind: 'variant'`. */
  variantId?: number
  variantOptions?: string
}

type AnyDoc = LooseDoc

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0)

/** Renders a variant's option values as "50ml / Rose". */
function describeOptions(variant: AnyDoc): string | undefined {
  const options = Array.isArray(variant?.options) ? variant.options : []

  const labels = options
    .map((option: AnyDoc) => (typeof option === 'object' && option ? option.label || option.value : null))
    .filter((label: unknown): label is string => typeof label === 'string' && label.length > 0)

  return labels.length > 0 ? labels.join(' / ') : undefined
}

/** Loads the variants that belong to one product. */
async function variantsForProduct(payload: Payload, productId: number): Promise<AnyDoc[]> {
  const { docs } = await payload.find({
    collection: 'variants',
    depth: 1,
    limit: 200,
    pagination: false,
    where: { product: { equals: productId } },
  })

  return docs as AnyDoc[]
}

function productToTarget(product: AnyDoc, variants: AnyDoc[]): ResolvedTarget[] {
  const base = {
    productId: product.id as number,
    productTitle: (product.title as string) ?? '(untitled)',
    slug: (product.slug as string) ?? String(product.id),
  }

  // Variant products: one target per variant, because that is where inventory lives.
  if (product.enableVariants === true && variants.length > 0) {
    return variants.map((variant) => {
      const options = describeOptions(variant)

      return {
        ...base,
        inventory: asNumber(variant.inventory),
        kind: 'variant' as const,
        label: options ? `${base.productTitle} — ${options}` : `${base.productTitle} — ${variant.title ?? variant.id}`,
        variantId: variant.id as number,
        variantOptions: options,
      }
    })
  }

  return [
    {
      ...base,
      inventory: asNumber(product.inventory),
      kind: 'product' as const,
      label: base.productTitle,
    },
  ]
}

/**
 * Resolves a free-text reference (slug, numeric id, product title, or a
 * "product + option" phrase) to concrete inventory rows.
 *
 * The model is told to call this first and to ask a follow-up question when it
 * returns more than one plausible row, rather than guessing.
 */
export async function resolveTargets(
  payload: Payload,
  query: string,
  limit = 8,
): Promise<ResolvedTarget[]> {
  const q = query.trim()
  const seen = new Set<string>()
  const out: ResolvedTarget[] = []

  const push = (targets: ResolvedTarget[]) => {
    for (const target of targets) {
      const key = `${target.kind}:${target.kind === 'variant' ? target.variantId : target.productId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(target)
    }
  }

  const collect = async (products: AnyDoc[]) => {
    for (const product of products) {
      const variants =
        product.enableVariants === true ? await variantsForProduct(payload, product.id as number) : []
      push(productToTarget(product, variants))
    }
  }

  // 1. Exact slug match wins outright — it is what a URL or a script would use.
  const bySlug = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 1,
    where: { slug: { equals: q } },
  })
  await collect(bySlug.docs as AnyDoc[])

  // 2. Numeric id.
  if (/^\d+$/.test(q)) {
    try {
      const byId = await payload.findByID({ collection: 'products', id: q, depth: 0 })
      if (byId) await collect([byId as AnyDoc])
    } catch {
      // Not a product id — fall through to text search.
    }
  }

  // 3. Product titles.
  if (out.length < limit) {
    const byTitle = await payload.find({
      collection: 'products',
      depth: 0,
      limit,
      where: { title: { contains: q } },
    })
    await collect(byTitle.docs as AnyDoc[])
  }

  // 4. Variant titles ("CK Essence 30ml - 50ml"). Useful when the admin names
  //    the option combination rather than the parent product.
  if (out.length < limit) {
    const byVariant = await payload.find({
      collection: 'variants',
      depth: 1,
      limit,
      where: { title: { contains: q } },
    })

    for (const variant of byVariant.docs as AnyDoc[]) {
      const product = typeof variant.product === 'object' ? (variant.product as AnyDoc) : null
      if (!product) continue
      const options = describeOptions(variant)
      push([
        {
          inventory: asNumber(variant.inventory),
          kind: 'variant',
          label: options ? `${product.title} — ${options}` : `${product.title} — ${variant.title}`,
          productId: product.id as number,
          productTitle: (product.title as string) ?? '(untitled)',
          slug: (product.slug as string) ?? String(product.id),
          variantId: variant.id as number,
          variantOptions: options,
        },
      ])
    }
  }

  return out.slice(0, limit)
}

/** Loads every inventory row, optionally only those at or below a threshold. */
export async function inventoryRows(
  payload: Payload,
  lowStockBelow?: number,
): Promise<ResolvedTarget[]> {
  const { docs: products } = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 1000,
    pagination: false,
    sort: 'title',
  })

  const rows: ResolvedTarget[] = []

  for (const product of products as AnyDoc[]) {
    if (product.enableVariants === true) {
      const variants = await variantsForProduct(payload, product.id as number)
      rows.push(...productToTarget(product, variants))
    } else {
      rows.push(...productToTarget(product, []))
    }
  }

  if (typeof lowStockBelow === 'number') {
    return rows.filter((row) => row.inventory <= lowStockBelow)
  }

  return rows
}
