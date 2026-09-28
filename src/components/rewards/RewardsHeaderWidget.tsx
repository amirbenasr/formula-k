'use client'

import { useAuth } from '@/providers/Auth'
import { Sparkles } from 'lucide-react'
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

  return (
    <Link
      className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary-ink transition-colors hover:bg-primary/20 sm:flex"
      href={user.rewardsEnabled ? '/account/rewards' : '/rewards'}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="font-medium">
        {!user.rewardsEnabled
          ? 'Glow Rewards'
          : points !== null
            ? `${points.toLocaleString('fr-FR')} pts`
            : '…'}
      </span>
    </Link>
  )
}
