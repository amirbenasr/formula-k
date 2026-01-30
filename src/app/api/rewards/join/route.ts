import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'

// Generate a unique referral code
function generateReferralCode(userId: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'GLOW'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get current user from auth
    const headersList = await headers()
    const cookieStore = await cookies()

    const { user } = await payload.auth({ headers: headersList, cookies: cookieStore })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if already a member
    if (user.rewardsEnabled) {
      return NextResponse.json({ error: 'Already a rewards member' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { referralCode } = body

    // Get the starter tier
    const tiers = await payload.find({
      collection: 'reward-tiers',
      where: { slug: { equals: 'starter' } },
      limit: 1,
    })

    const starterTier = tiers.docs[0]

    // Handle referral if provided
    let referrer = null
    if (referralCode) {
      const referrers = await payload.find({
        collection: 'users',
        where: { referralCode: { equals: referralCode.toUpperCase() } },
        limit: 1,
      })
      if (referrers.docs[0] && referrers.docs[0].id !== user.id) {
        referrer = referrers.docs[0]
      }
    }

    // Generate unique referral code for this user
    let newReferralCode = generateReferralCode(user.id)
    let codeExists = true
    let attempts = 0
    while (codeExists && attempts < 10) {
      const existing = await payload.find({
        collection: 'users',
        where: { referralCode: { equals: newReferralCode } },
        limit: 1,
      })
      if (existing.docs.length === 0) {
        codeExists = false
      } else {
        newReferralCode = generateReferralCode(user.id)
        attempts++
      }
    }

    // Update user with rewards info
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        rewardsEnabled: true,
        rewardPoints: 100, // Welcome bonus
        lifetimePoints: 100,
        rewardTier: starterTier?.id || null,
        referralCode: newReferralCode,
        referredBy: referrer?.id || null,
        rewardsJoinedAt: new Date().toISOString(),
      },
    })

    // Create welcome bonus transaction
    await payload.create({
      collection: 'reward-transactions',
      data: {
        user: user.id,
        type: 'earned',
        points: 100,
        action: 'welcome',
        description: 'Welcome bonus for joining Glow Rewards',
      },
    })

    // If referred, award points to referrer (they get points when referral makes first order)
    // We'll handle referral rewards in the order completion hook

    return NextResponse.json({
      success: true,
      message: 'Welcome to Glow Rewards!',
      points: 100,
      referralCode: newReferralCode,
      tier: starterTier?.name || 'Starter',
    })
  } catch (error) {
    console.error('Join rewards error:', error)
    return NextResponse.json(
      { error: 'An error occurred while joining the rewards program' },
      { status: 500 },
    )
  }
}
