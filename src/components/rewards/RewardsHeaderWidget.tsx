'use client'

import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

export const RewardsHeaderWidget: React.FC = () => {
  const { user } = useAuth()
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    if (user?.rewardsEnabled) {
      // Fetch points balance
      fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/balance`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.isRewardsMember) {
            setPoints(data.points)
          }
        })
        .catch(() => {
          // Silently fail
        })
    }
  }, [user])

  if (!user) {
    return null
  }

  if (!user.rewardsEnabled) {
    return (
      <Link
        href="/rewards"
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-rose-100 to-amber-100 dark:from-rose-950/40 dark:to-amber-950/40 rounded-full hover:opacity-80 transition-opacity"
      >
        <span>✨</span>
        <span className="font-medium">Join Rewards</span>
      </Link>
    )
  }

  return (
    <Link
      href="/account/rewards"
      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-rose-100 to-amber-100 dark:from-rose-950/40 dark:to-amber-950/40 rounded-full hover:opacity-80 transition-opacity"
    >
      <span>✨</span>
      <span className="font-medium">
        {points !== null ? `${points.toLocaleString()} pts` : '...'}
      </span>
    </Link>
  )
}
