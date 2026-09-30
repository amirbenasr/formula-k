/**
 * Verifies the assistant's catalogue path end to end, for one concrete request:
 * add "Lip Sleeping Mask EX (Berry) 3g" and "Bouncy Sleeping Mask 10ml" under the
 * Laneige brand, price 1.00, quantity 9, published.
 *
 * It deliberately goes through the SAME code the admin UI uses:
 *
 *   stage_brand_create   → applyAction   (a product cannot point at a brand that
 *   stage_product_create → applyAction    does not exist)
 *
 * so a pass proves the staging validators, the AiActionLog rows, the apply
 * dispatcher and the Local API writes all line up — not just that raw SQL works.
 *
 * Usage:
 *   pnpm tsx scripts/stock/create-laneige-products.ts           # dry run
 *   pnpm tsx scripts/stock/create-laneige-products.ts --apply   # write
 *
 * Note: a dry run still creates the brand, because the products cannot be
 * validated against a brand id that does not exist yet. Both modes are
 * idempotent — the brand and each product are looked up before being staged.
 */

import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { applyAction } from '../../src/lib/ai/apply'
import { stageBrandWrite, stageProductStatus, stageProductWrite } from '../../src/lib/ai/catalogue'
import type { AiToolContext } from '../../src/lib/ai/types'
import type { User } from '../../src/payload-types'

const APPLY = process.argv.includes('--apply')

const BRAND = { slug: 'laneige', title: 'Laneige' }

const PRODUCTS = [
  {
    inventory: 9,
    price: 1,
    slug: 'lip-sleeping-mask-ex-berry-3g',
    title: 'Lip Sleeping Mask EX (Berry) 3g',
  },
  {
    inventory: 9,
    price: 1,
    slug: 'bouncy-sleeping-mask-10ml',
    title: 'Bouncy Sleeping Mask 10ml',
  },
]

function report(label: string, value: unknown) {
  console.log(`\n=== ${label} ===`)
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

async function main() {
  const payload = await getPayload({ config })

  const admins = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: { roles: { in: ['admin'] } },
  })

  const user = admins.docs[0] as unknown as User | undefined

  if (!user) throw new Error('No admin user found to act as.')

  const context: AiToolContext = { conversationId: 'verify-laneige', payload, user }

  const findBrand = async () => {
    const found = await payload.find({
      collection: 'brands',
      depth: 0,
      limit: 1,
      where: { slug: { equals: BRAND.slug } },
    })

    return found.docs[0]?.id as number | undefined
  }

  // 1. The brand, created through the staged path when it is missing.
  let brandId = await findBrand()

  if (brandId !== undefined) {
    report('brand already exists — no create needed', { brandId, title: BRAND.title })
  } else {
    const staged = await stageBrandWrite(context, { brand: BRAND })

    report('staged: brand', staged)

    if (!staged.staged) throw new Error(`Brand staging failed: ${staged.problems.join('; ')}`)

    const applied = await applyAction({ actionId: staged.actionId, payload, user })

    report('applied: brand', applied)

    brandId = await findBrand()
  }

  if (brandId === undefined) throw new Error('Brand is still missing; cannot attach products.')

  // 2. The products, each staged after the same duplicate check the assistant is
  //    instructed to run before proposing anything.
  for (const product of PRODUCTS) {
    const existing = await payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      where: { slug: { equals: product.slug } },
    })

    if (existing.docs.length > 0) {
      report(`"${product.title}" already exists — no create needed`, {
        id: existing.docs[0].id,
        slug: product.slug,
        status: existing.docs[0]._status,
      })
      continue
    }

    const staged = await stageProductWrite(context, {
      product: {
        brand: brandId,
        inventory: product.inventory,
        price: product.price,
        slug: product.slug,
        status: 'published',
        title: product.title,
      },
    })

    report(`staged: "${product.title}"`, staged)

    if (!staged.staged) {
      throw new Error(`Product staging failed for "${product.title}": ${staged.problems.join('; ')}`)
    }

    if (!APPLY) {
      console.log('   (dry run — not applied; re-run with --apply to write)')
      continue
    }

    report(
      `applied: "${product.title}"`,
      await applyAction({ actionId: staged.actionId, payload, user }),
    )
  }

  // 3. Read back what actually landed.
  const final = await payload.find({
    collection: 'products',
    depth: 1,
    limit: 10,
    where: { slug: { in: PRODUCTS.map((product) => product.slug) } },
  })

  report(
    'read back',
    final.docs.map((doc) => ({
      brand: typeof doc.brand === 'object' ? doc.brand?.title : doc.brand,
      id: doc.id,
      inventory: doc.inventory,
      price: doc.priceInUSD,
      priceEnabled: doc.priceInUSDEnabled,
      slug: doc.slug,
      status: doc._status,
      title: doc.title,
    })),
  )

  // 4. Publishing is confirmed through the assistant's own status tool: asking to
  //    publish an already-published product must report "nothing to change".
  for (const doc of final.docs) {
    const check = await stageProductStatus(context, { id: String(doc.id), publish: true })

    console.log(
      `\npublish check "${doc.title}": ${
        check.staged ? 'STAGED (unexpected — it was already published)' : check.problems.join('; ')
      }`,
    )
  }

  const actions = await payload.find({
    collection: 'ai-action-logs',
    depth: 0,
    limit: 20,
    sort: '-createdAt',
    where: { conversationId: { equals: 'verify-laneige' } },
  })

  report(
    'audit log',
    actions.docs.map((action) => ({
      id: action.id,
      kind: action.kind,
      status: action.status,
      summary: action.summary,
      tool: action.toolName,
    })),
  )

  process.exit(0)
}

void main()
