import type { RewardsCatalog } from '@/payload-types'
import config from '@payload-config'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

// Default tiers configuration
const defaultTiers = [
  {
    name: 'Starter',
    slug: 'starter',
    minPoints: 0,
    pointsMultiplier: 1,
    icon: '🌱',
    color: '#10b981',
    order: 1,
    benefits: [
      { benefit: 'Earn 1 point per 1 TND spent' },
      { benefit: 'Access to rewards catalog' },
      { benefit: 'Birthday bonus points' },
    ],
  },
  {
    name: 'Glowing',
    slug: 'glowing',
    minPoints: 500,
    pointsMultiplier: 1.25,
    icon: '✨',
    color: '#f59e0b',
    order: 2,
    benefits: [
      { benefit: '1.25x points on all purchases' },
      { benefit: 'Birthday gift' },
      { benefit: 'Early access to sales' },
      { benefit: 'Exclusive member-only offers' },
    ],
  },
  {
    name: 'Radiant',
    slug: 'radiant',
    minPoints: 1500,
    pointsMultiplier: 1.5,
    icon: '💫',
    color: '#f43f5e',
    order: 3,
    benefits: [
      { benefit: '1.5x points on all purchases' },
      { benefit: 'Free shipping on all orders' },
      { benefit: 'Early access to new products' },
      { benefit: 'Exclusive products access' },
      { benefit: 'Priority customer support' },
    ],
  },
  {
    name: 'Glass Skin',
    slug: 'glass-skin',
    minPoints: 5000,
    pointsMultiplier: 2,
    icon: '💎',
    color: '#8b5cf6',
    order: 4,
    benefits: [
      { benefit: '2x points on all purchases' },
      { benefit: 'Free express shipping' },
      { benefit: 'First access to everything' },
      { benefit: 'Exclusive VIP gifts' },
      { benefit: 'Dedicated VIP support' },
      { benefit: 'Annual appreciation gift' },
    ],
  },
]

// Default rewards configuration
const defaultRewards: Partial<RewardsCatalog>[] = [
  {
    name: 'Free Sample Pack',
    description: 'Get a surprise sample with your next order',
    pointsCost: 100,
    type: 'free_sample',
    isActive: true,
    isFeatured: false,
    order: 1,
  },
  {
    name: '10 TND Off',
    description: 'Get 10 TND discount on your next order',
    pointsCost: 250,
    type: 'discount_amount',
    discountValue: 10,
    isActive: true,
    isFeatured: false,
    order: 2,
  },
  {
    name: '25 TND Off',
    description: 'Get 25 TND discount on your next order',
    pointsCost: 500,
    type: 'discount_amount',
    discountValue: 25,
    isActive: true,
    isFeatured: true,
    order: 3,
  },
  {
    name: 'Sheet Mask Set (5 pcs)',
    description: 'Luxurious sheet mask collection',
    pointsCost: 750,
    type: 'free_product',
    isActive: true,
    isFeatured: false,
    order: 4,
  },
  {
    name: 'Free Travel-Size Product',
    description: 'Choose any travel-size product',
    pointsCost: 1000,
    type: 'free_product',
    isActive: true,
    isFeatured: true,
    order: 5,
  },
  {
    name: '50 TND Off',
    description: 'Get 50 TND discount on your next order',
    pointsCost: 2000,
    type: 'discount_amount',
    discountValue: 50,
    isActive: true,
    isFeatured: false,
    order: 6,
  },
  {
    name: 'Free Full-Size Product',
    description: 'Choose any full-size product up to 100 TND',
    pointsCost: 5000,
    type: 'free_product',
    isActive: true,
    isFeatured: true,
    order: 7,
  },
  {
    name: 'Free Shipping',
    description: 'Free shipping on your next order',
    pointsCost: 150,
    type: 'free_shipping',
    isActive: true,
    isFeatured: false,
    order: 8,
  },
  {
    name: '15% Off Order',
    description: 'Get 15% off your entire order',
    pointsCost: 400,
    type: 'discount_percent',
    discountValue: 15,
    isActive: true,
    isFeatured: false,
    order: 9,
  },
]

export async function POST(_request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Check if user is admin
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user || !user.roles?.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const results = {
      tiers: { created: 0, skipped: 0 },
      rewards: { created: 0, skipped: 0 },
    }

    // Seed tiers
    for (const tier of defaultTiers) {
      // Check if tier already exists
      const existing = await payload.find({
        collection: 'reward-tiers',
        where: { slug: { equals: tier.slug } },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'reward-tiers',
          data: tier,
          draft: true,
        })
        results.tiers.created++
      } else {
        results.tiers.skipped++
      }
    }

    // Seed rewards
    for (const reward of defaultRewards) {
      // Check if reward already exists by name
      const existing = await payload.find({
        collection: 'rewards-catalog',
        where: { name: { equals: reward.name } },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'rewards-catalog',
          data: reward,
          draft: true,
        })
        results.rewards.created++
      } else {
        results.rewards.skipped++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Seed completed',
      results,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'An error occurred while seeding data' }, { status: 500 })
  }
}
