import { checkRole } from '@/access/utilities'
import { CompetitorSearchError } from '@/lib/competitorPrices/errors'
import { searchCompetitorPrices } from '@/lib/competitorPrices/search'
import type { User } from '@/payload-types'
import { APIError, type Endpoint } from 'payload'

/**
 * Backs the "Check prices" button on the Competitor Prices tab.
 *
 * Custom endpoints are unauthenticated by default, so this one starts by
 * requiring a signed-in admin — the same reasoning as `/api/admin-ai/chat`.
 * Every database call then runs as that admin with `overrideAccess: false`, so
 * neither the read nor the write can exceed what the person clicking could do
 * by hand.
 *
 * Rows are upserted per (product, competitor domain): a shop that appears in
 * every search updates its one row instead of adding another. Rows that this
 * search did not return are left alone — their `fetchedAt` simply stays old,
 * which is how the table shows that a price is going stale.
 */
export const competitorPricesFetchEndpoint: Endpoint = {
  path: '/competitor-prices/fetch',
  method: 'post',
  handler: async (req) => {
    const { user } = req

    if (!user || !checkRole(['admin'], user as User)) {
      throw new APIError('Unauthorized — competitor prices are restricted to admins.', 401)
    }

    const admin = user as User

    let body: { productId?: number | string } = {}

    try {
      body = (await req.json?.()) ?? {}
    } catch {
      throw new APIError('Expected a JSON body with `productId`.', 400)
    }

    const { productId } = body

    if (productId === undefined || productId === null || productId === '') {
      throw new APIError('`productId` is required.', 400)
    }

    const product = await req.payload.findByID({
      collection: 'products',
      depth: 1,
      id: productId,
      overrideAccess: false,
      user: admin,
    })

    const title = typeof product.title === 'string' ? product.title : ''
    const brand =
      typeof product.brand === 'object' && product.brand !== null
        ? (product.brand.title ?? undefined)
        : undefined

    // A variant product has no single price; the cheapest variant is what the
    // storefront advertises as "from", and it is the one worth comparing.
    const variants = Array.isArray(product.variants)
      ? (product.variants as { priceInUSD?: null | number }[])
      : []
    const variantPrices = variants
      .map((variant) => variant.priceInUSD)
      .filter((price): price is number => typeof price === 'number')

    const ourPrice =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : typeof product.priceInUSD === 'number'
          ? product.priceInUSD
          : undefined

    let outcome

    try {
      outcome = await searchCompetitorPrices({ brand, referencePrice: ourPrice, title })
    } catch (error) {
      if (error instanceof CompetitorSearchError) {
        return Response.json({ error: error.message, ok: false }, { status: error.status })
      }

      throw error
    }

    const now = new Date().toISOString()
    const saved: (number | string)[] = []

    for (const offer of outcome.offers) {
      const { docs } = await req.payload.find({
        collection: 'competitor-prices',
        depth: 0,
        limit: 1,
        overrideAccess: false,
        user: admin,
        where: {
          and: [{ product: { equals: product.id } }, { source: { equals: offer.source } }],
        },
      })

      const existing = docs[0]
      const previous =
        typeof existing?.competitorPrice === 'number' ? existing.competitorPrice : null
      const changed = previous !== null && previous !== offer.price

      const data = {
        competitorPrice: offer.price,
        fetchMethod: 'serpapi' as const,
        fetchedAt: now,
        matchConfidence: offer.confidence,
        product: product.id,
        rawPriceText: offer.rawPriceText,
        source: offer.source,
        title: offer.title,
        url: offer.url,
        ...(changed ? { previousPrice: previous, priceChangedAt: now } : {}),
      }

      if (existing) {
        await req.payload.update({
          collection: 'competitor-prices',
          data,
          depth: 0,
          id: existing.id,
          overrideAccess: false,
          user: admin,
        })

        saved.push(existing.id)
      } else {
        const created = await req.payload.create({
          collection: 'competitor-prices',
          data,
          depth: 0,
          overrideAccess: false,
          user: admin,
        })

        saved.push(created.id)
      }
    }

    return Response.json({
      checkedAt: now,
      found: outcome.offers.length,
      message:
        outcome.offers.length === 0
          ? `No Tunisian shop listed "${title}" with a readable price. Google returned ${outcome.scanned} result${outcome.scanned === 1 ? '' : 's'}.`
          : undefined,
      ok: true,
      ourPrice: ourPrice ?? null,
      rows: saved,
      scanned: outcome.scanned,
    })
  },
}
