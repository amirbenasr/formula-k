'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Tier {
  name: string
  slug: string
  icon: string
  color: string
  pointsMultiplier: number
  benefits: { benefit: string }[]
}

interface NextTier {
  name: string
  minPoints: number
  pointsToReach: number
}

interface Transaction {
  id: number
  type: string
  points: number
  action: string
  description: string
  createdAt: string
}

interface Reward {
  id: number
  name: string
  description: string
  pointsCost: number
  type: string
  discountValue: number
  isFeatured: boolean
  isAvailable: boolean
}

interface RewardsData {
  isRewardsMember: boolean
  points: number
  lifetimePoints: number
  tier: Tier | null
  nextTier: NextTier | null
  referralCode: string
  referralCount: number
  checkInStreak: number
  lastCheckIn: string | null
  recentTransactions: Transaction[]
}

const actionLabels: Record<string, string> = {
  welcome: 'Welcome Bonus',
  profile_complete: 'Profile Completed',
  purchase: 'Purchase',
  review: 'Review',
  review_photo: 'Review Photo',
  referral: 'Referral',
  birthday: 'Birthday Bonus',
  social_follow: 'Social Follow',
  checkin: 'Daily Check-in',
  challenge: 'Challenge',
  redemption: 'Reward Redeemed',
}

export const RewardsDashboard: React.FC = () => {
  const { user } = useAuth()
  const [data, setData] = useState<RewardsData | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [redeeming, setRedeeming] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [balanceRes, catalogRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/balance`, {
          credentials: 'include',
        }),
        fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/catalog`),
      ])

      const balanceData = await balanceRes.json()
      const catalogData = await catalogRes.json()

      setData(balanceData)
      setRewards(catalogData.rewards || [])
    } catch (error) {
      toast.error('Failed to load rewards data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/checkin`, {
        method: 'POST',
        credentials: 'include',
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message)
        fetchData()
      } else {
        toast.error(result.error || 'Check-in failed')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleRedeem = async (rewardId: number) => {
    setRedeeming(rewardId)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rewardId }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message)
        if (result.redemptionCode) {
          toast.success(`Your code: ${result.redemptionCode}`, { duration: 10000 })
        }
        fetchData()
      } else {
        toast.error(result.error || 'Redemption failed')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setRedeeming(null)
    }
  }

  const copyReferralCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode)
      setCopied(true)
      toast.success('Referral code copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const canCheckIn = () => {
    if (!data?.lastCheckIn) return true
    const lastCheckIn = new Date(data.lastCheckIn)
    const today = new Date()
    lastCheckIn.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    return today > lastCheckIn
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (!data?.isRewardsMember) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✨</div>
        <h2 className="text-2xl font-bold mb-4">Join Glow Rewards</h2>
        <p className="text-muted-foreground mb-6">
          You're not a rewards member yet. Join now and earn 100 welcome points!
        </p>
        <Button asChild className="rounded-full">
          <Link href="/rewards">Learn More & Join</Link>
        </Button>
      </div>
    )
  }

  const progressToNextTier = data.nextTier
    ? ((data.lifetimePoints - (data.nextTier.minPoints - data.nextTier.pointsToReach)) /
        data.nextTier.minPoints) * 100
    : 100

  return (
    <div className="space-y-8">
      {/* Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Points */}
        <div className="col-span-1 md:col-span-2 p-6 bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-950/40 dark:to-amber-950/40 rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Points</p>
              <p className="text-5xl font-bold">{data.points.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Current Tier</p>
              <p className="text-2xl">
                {data.tier?.icon} {data.tier?.name}
              </p>
              <p className="text-sm text-primary font-medium">{data.tier?.pointsMultiplier}x points</p>
            </div>
          </div>

          {/* Progress to next tier */}
          {data.nextTier && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress to {data.nextTier.name}</span>
                <span>{data.nextTier.pointsToReach.toLocaleString()} pts to go</span>
              </div>
              <div className="h-3 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(progressToNextTier, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Daily Check-in */}
        <div className="p-6 bg-white dark:bg-white/5 border rounded-2xl text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold mb-2">Daily Check-in</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {data.checkInStreak > 0
              ? `${data.checkInStreak} day streak! 🔥`
              : 'Start your streak!'}
          </p>
          <Button
            onClick={handleCheckIn}
            disabled={checkingIn || !canCheckIn()}
            variant={canCheckIn() ? 'default' : 'outline'}
            className="w-full rounded-full"
          >
            {checkingIn
              ? 'Checking in...'
              : canCheckIn()
                ? '+5 Points'
                : 'Come back tomorrow!'}
          </Button>
        </div>
      </div>

      {/* Referral Section */}
      <div className="p-6 bg-gradient-to-r from-violet-100 to-rose-100 dark:from-violet-950/30 dark:to-rose-950/30 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg mb-1">👯 Share the Glow</h3>
            <p className="text-sm text-muted-foreground">
              Invite friends and earn 200 points when they make their first purchase!
              <br />
              You've referred <span className="font-bold">{data.referralCount}</span> friends.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-white dark:bg-black/30 rounded-lg font-mono font-bold">
              {data.referralCode}
            </div>
            <Button variant="outline" onClick={copyReferralCode} className="rounded-full">
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      {/* Rewards Catalog */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Redeem Rewards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => {
            const canAfford = data.points >= reward.pointsCost
            const isRedeeming = redeeming === reward.id

            return (
              <div
                key={reward.id}
                className={`p-5 border rounded-xl transition-all ${
                  canAfford && reward.isAvailable
                    ? 'bg-white dark:bg-white/5 hover:border-primary'
                    : 'bg-gray-50 dark:bg-white/5 opacity-60'
                }`}
              >
                {reward.isFeatured && (
                  <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full mb-2">
                    ⭐ Featured
                  </span>
                )}
                <h4 className="font-semibold mb-1">{reward.name}</h4>
                {reward.description && (
                  <p className="text-sm text-muted-foreground mb-3">{reward.description}</p>
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-primary">
                    {reward.pointsCost.toLocaleString()} pts
                  </span>
                  <Button
                    size="sm"
                    variant={canAfford ? 'default' : 'outline'}
                    disabled={!canAfford || !reward.isAvailable || isRedeeming}
                    onClick={() => handleRedeem(reward.id)}
                    className="rounded-full"
                  >
                    {isRedeeming
                      ? 'Redeeming...'
                      : !reward.isAvailable
                        ? 'Sold Out'
                        : canAfford
                          ? 'Redeem'
                          : 'Need More'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
        {data.recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {data.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border rounded-xl"
              >
                <div>
                  <p className="font-medium">
                    {actionLabels[transaction.action] || transaction.action}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={`text-lg font-bold ${
                    transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {transaction.points > 0 ? '+' : ''}
                  {transaction.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No activity yet. Start earning points!
          </p>
        )}

        <div className="text-center mt-6">
          <Button variant="outline" asChild className="rounded-full">
            <Link href="/account/rewards/history">View Full History</Link>
          </Button>
        </div>
      </div>

      {/* Tier Benefits */}
      {data.tier && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Your {data.tier.name} Benefits</h3>
          <div className="p-6 bg-white dark:bg-white/5 border rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.tier.benefits?.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-green-600 text-xl">✓</span>
                  <span>{b.benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
