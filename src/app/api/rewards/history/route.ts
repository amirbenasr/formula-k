import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    const headersList = await headers()
    const cookieStore = await cookies()

    const { user } = await payload.auth({ headers: headersList, cookies: cookieStore })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!user.rewardsEnabled) {
      return NextResponse.json({ error: 'Not a rewards member' }, { status: 400 })
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const type = searchParams.get('type') // 'earned', 'redeemed', or null for all

    // Build query
    const where: any = {
      user: { equals: user.id },
    }

    if (type && ['earned', 'redeemed', 'expired', 'adjusted'].includes(type)) {
      where.type = { equals: type }
    }

    const transactions = await payload.find({
      collection: 'reward-transactions',
      where,
      sort: '-createdAt',
      page,
      limit,
    })

    return NextResponse.json({
      transactions: transactions.docs.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        action: t.action,
        description: t.description,
        createdAt: t.createdAt,
      })),
      pagination: {
        page: transactions.page,
        totalPages: transactions.totalPages,
        totalDocs: transactions.totalDocs,
        hasNextPage: transactions.hasNextPage,
        hasPrevPage: transactions.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json(
      { error: 'An error occurred while fetching transaction history' },
      { status: 500 },
    )
  }
}
