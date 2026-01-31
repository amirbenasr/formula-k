import config from '@payload-config'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

const CHECKIN_POINTS = 5
const STREAK_BONUS_DAYS = 7
const STREAK_BONUS_POINTS = 50

export async function POST(_request: NextRequest) {
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null
    if (lastCheckIn) {
      lastCheckIn.setHours(0, 0, 0, 0)
    }

    // Check if already checked in today
    if (lastCheckIn && lastCheckIn.getTime() === today.getTime()) {
      return NextResponse.json(
        {
          error: 'Already checked in today',
          nextCheckIn: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { status: 400 },
      )
    }

    // Calculate streak
    let newStreak = 1
    if (lastCheckIn) {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (lastCheckIn.getTime() === yesterday.getTime()) {
        // Consecutive day
        newStreak = (user.checkInStreak || 0) + 1
      }
      // Otherwise streak resets to 1
    }

    // Calculate points
    let pointsEarned = CHECKIN_POINTS
    let streakBonus = false

    // Streak bonus
    if (newStreak > 0 && newStreak % STREAK_BONUS_DAYS === 0) {
      pointsEarned += STREAK_BONUS_POINTS
      streakBonus = true
    }

    // Update user
    const newPoints = (user.rewardPoints || 0) + pointsEarned
    const newLifetime = (user.lifetimePoints || 0) + pointsEarned

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        rewardPoints: newPoints,
        lifetimePoints: newLifetime,
        lastCheckIn: today.toISOString(),
        checkInStreak: newStreak,
      },
    })

    // Create transaction
    await payload.create({
      collection: 'reward-transactions',
      data: {
        user: user.id,
        type: 'earned',
        points: pointsEarned,
        action: 'checkin',
        description: streakBonus
          ? `Daily check-in (${newStreak} day streak bonus!)`
          : `Daily check-in (Day ${newStreak})`,
      },
    })

    // Check for tier upgrade
    await updateUserTier(payload, user.id, newLifetime)

    return NextResponse.json({
      success: true,
      pointsEarned,
      streak: newStreak,
      streakBonus,
      totalPoints: newPoints,
      nextCheckIn: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      message: streakBonus
        ? `+${CHECKIN_POINTS} points + ${STREAK_BONUS_POINTS} streak bonus!`
        : `+${CHECKIN_POINTS} points! ${STREAK_BONUS_DAYS - (newStreak % STREAK_BONUS_DAYS)} days until streak bonus`,
    })
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json({ error: 'An error occurred during check-in' }, { status: 500 })
  }
}

async function updateUserTier(payload: Payload, userId: number, lifetimePoints: number) {
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
}
