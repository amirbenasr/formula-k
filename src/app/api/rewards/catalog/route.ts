import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    const now = new Date().toISOString()

    // Get active rewards
    const rewards = await payload.find({
      collection: 'rewards-catalog',
      where: {
        and: [
          { isActive: { equals: true } },
          {
            or: [
              { validFrom: { exists: false } },
              { validFrom: { less_than_equal: now } },
            ],
          },
          {
            or: [
              { validUntil: { exists: false } },
              { validUntil: { greater_than_equal: now } },
            ],
          },
        ],
      },
      sort: 'order',
      limit: 100,
      depth: 1,
    })

    // Get tiers for reference
    const tiers = await payload.find({
      collection: 'reward-tiers',
      sort: 'order',
      limit: 10,
    })

    return NextResponse.json({
      rewards: rewards.docs.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        pointsCost: r.pointsCost,
        type: r.type,
        discountValue: r.discountValue,
        image: r.image,
        minimumTier: r.minimumTier,
        isFeatured: r.isFeatured,
        totalAvailable: r.totalAvailable,
        totalRedeemed: r.totalRedeemed,
        isAvailable: !r.totalAvailable || (r.totalRedeemed || 0) < r.totalAvailable,
      })),
      tiers: tiers.docs.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        minPoints: t.minPoints,
        pointsMultiplier: t.pointsMultiplier,
        icon: t.icon,
        color: t.color,
        benefits: t.benefits,
      })),
    })
  } catch (error) {
    console.error('Get catalog error:', error)
    return NextResponse.json(
      { error: 'An error occurred while fetching rewards catalog' },
      { status: 500 },
    )
  }
}
