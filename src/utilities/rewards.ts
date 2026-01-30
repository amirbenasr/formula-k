import type { Payload } from 'payload'

export type RewardAction =
  | 'welcome'
  | 'profile_complete'
  | 'purchase'
  | 'review'
  | 'review_photo'
  | 'referral'
  | 'birthday'
  | 'social_follow'
  | 'checkin'
  | 'challenge'

// Base points for each action
export const REWARD_POINTS: Record<RewardAction, number> = {
  welcome: 100,
  profile_complete: 50,
  purchase: 1, // per TND spent
  review: 50,
  review_photo: 25, // bonus on top of review
  referral: 200,
  birthday: 100,
  social_follow: 25,
  checkin: 5,
  challenge: 100,
}

export async function awardPoints(
  payload: Payload,
  userId: number,
  action: RewardAction,
  options: {
    points?: number
    description?: string
    orderId?: number
    metadata?: Record<string, unknown>
  } = {},
): Promise<{ success: boolean; pointsAwarded: number; newBalance: number }> {
  try {
    // Get user
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    if (!user || !user.rewardsEnabled) {
      return { success: false, pointsAwarded: 0, newBalance: 0 }
    }

    // Get user's tier for multiplier
    let multiplier = 1
    if (user.rewardTier) {
      const tierId = typeof user.rewardTier === 'object' ? user.rewardTier.id : user.rewardTier
      const tier = await payload.findByID({
        collection: 'reward-tiers',
        id: tierId,
      })
      if (tier?.pointsMultiplier) {
        multiplier = tier.pointsMultiplier
      }
    }

    // Calculate points
    const basePoints = options.points ?? REWARD_POINTS[action]

    // Apply multiplier for purchase actions
    const pointsToAward = action === 'purchase' ? Math.floor(basePoints * multiplier) : basePoints

    // Update user points
    const newRewardPoints = (user.rewardPoints || 0) + pointsToAward
    const newLifetimePoints = (user.lifetimePoints || 0) + pointsToAward

    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        rewardPoints: newRewardPoints,
        lifetimePoints: newLifetimePoints,
      },
    })

    // Create transaction record
    await payload.create({
      collection: 'reward-transactions',
      data: {
        user: userId,
        type: 'earned',
        points: pointsToAward,
        action,
        description: options.description || getDefaultDescription(action, pointsToAward),
        relatedOrder: options.orderId || null,
        metadata: options.metadata || null,
      },
    })

    // Update tier if needed
    await updateUserTier(payload, userId, newLifetimePoints)

    return {
      success: true,
      pointsAwarded: pointsToAward,
      newBalance: newRewardPoints,
    }
  } catch (error) {
    console.error('Award points error:', error)
    return { success: false, pointsAwarded: 0, newBalance: 0 }
  }
}

export async function updateUserTier(
  payload: Payload,
  userId: number,
  lifetimePoints: number,
): Promise<void> {
  try {
    // Find appropriate tier based on lifetime points
    const tiers = await payload.find({
      collection: 'reward-tiers',
      where: {
        minPoints: { less_than_equal: lifetimePoints },
      },
      sort: '-minPoints',
      limit: 1,
    })

    if (tiers.docs[0]) {
      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          rewardTier: tiers.docs[0].id,
        },
      })
    }
  } catch (error) {
    console.error('Update tier error:', error)
  }
}

function getDefaultDescription(action: RewardAction, points: number): string {
  const descriptions: Record<RewardAction, string> = {
    welcome: 'Welcome bonus for joining Glow Rewards',
    profile_complete: 'Profile completion bonus',
    purchase: `Earned ${points} points from purchase`,
    review: 'Review submitted',
    review_photo: 'Photo added to review',
    referral: 'Friend referral bonus',
    birthday: 'Birthday bonus',
    social_follow: 'Social media follow bonus',
    checkin: 'Daily check-in',
    challenge: 'Challenge completed',
  }
  return descriptions[action]
}

export async function processReferralReward(
  payload: Payload,
  referrerId: number,
  referredUserId: number,
): Promise<void> {
  try {
    const referrer = await payload.findByID({
      collection: 'users',
      id: referrerId,
    })

    if (!referrer || !referrer.rewardsEnabled) return

    // Award referral points
    await awardPoints(payload, referrerId, 'referral', {
      description: 'Friend made their first purchase',
      metadata: { referredUser: referredUserId },
    })

    // Update referral count
    await payload.update({
      collection: 'users',
      id: referrerId,
      data: {
        referralCount: (referrer.referralCount || 0) + 1,
      },
    })
  } catch (error) {
    console.error('Process referral reward error:', error)
  }
}
