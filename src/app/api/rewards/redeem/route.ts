import config from '@payload-config'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    const headersList = await headers()

    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!user.rewardsEnabled) {
      return NextResponse.json({ error: 'Join the rewards program first' }, { status: 400 })
    }

    const body = await request.json()
    const { rewardId } = body

    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 })
    }

    // Get the reward
    const reward = await payload.findByID({
      collection: 'rewards-catalog',
      id: rewardId,
    })

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    // Check if reward is active
    if (!reward.isActive) {
      return NextResponse.json({ error: 'This reward is no longer available' }, { status: 400 })
    }

    // Check validity dates
    const now = new Date()
    if (reward.validFrom && new Date(reward.validFrom) > now) {
      return NextResponse.json({ error: 'This reward is not yet available' }, { status: 400 })
    }
    if (reward.validUntil && new Date(reward.validUntil) < now) {
      return NextResponse.json({ error: 'This reward has expired' }, { status: 400 })
    }

    // Check if user has enough points
    if ((user.rewardPoints || 0) < reward.pointsCost) {
      return NextResponse.json(
        {
          error: 'Not enough points',
          required: reward.pointsCost,
          available: user.rewardPoints || 0,
        },
        { status: 400 },
      )
    }

    // Check tier requirement
    if (reward.minimumTier) {
      const requiredTierId =
        typeof reward.minimumTier === 'object' ? reward.minimumTier.id : reward.minimumTier
      const userTierId = user.rewardTier
        ? typeof user.rewardTier === 'object'
          ? user.rewardTier.id
          : user.rewardTier
        : null

      if (!userTierId) {
        return NextResponse.json({ error: 'Higher tier required for this reward' }, { status: 400 })
      }

      // Get tier orders to compare
      const requiredTier = await payload.findByID({
        collection: 'reward-tiers',
        id: requiredTierId,
      })
      const userTier = await payload.findByID({
        collection: 'reward-tiers',
        id: userTierId,
      })

      if (userTier.order < requiredTier.order) {
        return NextResponse.json(
          {
            error: `This reward requires ${requiredTier.name} tier or higher`,
          },
          { status: 400 },
        )
      }
    }

    // Check user limit
    if (reward.limitPerUser && reward.limitPerUser > 0) {
      const userRedemptions = await payload.count({
        collection: 'reward-transactions',
        where: {
          and: [
            { user: { equals: user.id } },
            { action: { equals: 'redemption' } },
            { relatedReward: { equals: rewardId } },
          ],
        },
      })

      if (userRedemptions.totalDocs >= reward.limitPerUser) {
        return NextResponse.json(
          {
            error: 'You have reached the maximum redemptions for this reward',
          },
          { status: 400 },
        )
      }
    }

    // Check total availability
    if (reward.totalAvailable && reward.totalAvailable > 0) {
      if ((reward.totalRedeemed || 0) >= reward.totalAvailable) {
        return NextResponse.json({ error: 'This reward is sold out' }, { status: 400 })
      }
    }

    // All checks passed - process redemption
    const newPoints = (user.rewardPoints || 0) - reward.pointsCost

    // Update user points
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        rewardPoints: newPoints,
      },
    })

    // Update reward redeemed count
    await payload.update({
      collection: 'rewards-catalog',
      id: rewardId,
      data: {
        totalRedeemed: (reward.totalRedeemed || 0) + 1,
      },
    })

    // Create transaction
    const transaction = await payload.create({
      collection: 'reward-transactions',
      data: {
        user: user.id,
        type: 'redeemed',
        points: -reward.pointsCost,
        action: 'redemption',
        description: `Redeemed: ${reward.name}`,
        relatedReward: rewardId,
        metadata: {
          rewardType: reward.type,
          discountValue: reward.discountValue,
        },
      },
    })

    // Generate redemption code for discount rewards
    let redemptionCode: string | null = null
    if (
      reward.type === 'discount_amount' ||
      reward.type === 'discount_percent' ||
      reward.type === 'free_shipping'
    ) {
      redemptionCode = `GLOW${user.id}${Date.now().toString(36).toUpperCase()}`
    }

    return NextResponse.json({
      success: true,
      message: `Successfully redeemed ${reward.name}!`,
      reward: {
        name: reward.name,
        type: reward.type,
        discountValue: reward.discountValue,
      },
      redemptionCode,
      transactionId: transaction.id,
      remainingPoints: newPoints,
    })
  } catch (error) {
    console.error('Redeem reward error:', error)
    return NextResponse.json(
      { error: 'An error occurred while redeeming the reward' },
      { status: 500 },
    )
  }
}
