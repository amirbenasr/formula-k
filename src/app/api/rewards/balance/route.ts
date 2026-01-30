import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get current user from auth
    const headersList = await headers()
    const cookieStore = await cookies()

    const { user } = await payload.auth({ headers: headersList, cookies: cookieStore })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!user.rewardsEnabled) {
      return NextResponse.json({
        isRewardsMember: false,
        message: 'Not a rewards member',
      })
    }

    // Get current tier details
    let tier = null
    if (user.rewardTier) {
      const tierId = typeof user.rewardTier === 'object' ? user.rewardTier.id : user.rewardTier
      tier = await payload.findByID({
        collection: 'reward-tiers',
        id: tierId,
      })
    }

    // Get next tier
    let nextTier = null
    let pointsToNextTier = 0
    if (tier) {
      const nextTiers = await payload.find({
        collection: 'reward-tiers',
        where: {
          minPoints: { greater_than: tier.minPoints },
        },
        sort: 'minPoints',
        limit: 1,
      })
      if (nextTiers.docs[0]) {
        nextTier = nextTiers.docs[0]
        pointsToNextTier = nextTier.minPoints - (user.lifetimePoints || 0)
      }
    }

    // Get recent transactions
    const recentTransactions = await payload.find({
      collection: 'reward-transactions',
      where: { user: { equals: user.id } },
      sort: '-createdAt',
      limit: 5,
    })

    return NextResponse.json({
      isRewardsMember: true,
      points: user.rewardPoints || 0,
      lifetimePoints: user.lifetimePoints || 0,
      tier: tier
        ? {
            name: tier.name,
            slug: tier.slug,
            icon: tier.icon,
            color: tier.color,
            pointsMultiplier: tier.pointsMultiplier,
            benefits: tier.benefits,
          }
        : null,
      nextTier: nextTier
        ? {
            name: nextTier.name,
            minPoints: nextTier.minPoints,
            pointsToReach: pointsToNextTier > 0 ? pointsToNextTier : 0,
          }
        : null,
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      checkInStreak: user.checkInStreak || 0,
      lastCheckIn: user.lastCheckIn,
      recentTransactions: recentTransactions.docs.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        action: t.action,
        description: t.description,
        createdAt: t.createdAt,
      })),
    })
  } catch (error) {
    console.error('Get balance error:', error)
    return NextResponse.json(
      { error: 'An error occurred while fetching rewards balance' },
      { status: 500 },
    )
  }
}
