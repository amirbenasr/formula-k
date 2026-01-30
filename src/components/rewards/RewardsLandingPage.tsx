'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

const tiers = [
  {
    name: 'Starter',
    icon: '🌱',
    minPoints: 0,
    multiplier: '1x',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    benefits: ['Earn 1 point per 1 TND spent', 'Access to rewards catalog', 'Birthday bonus'],
  },
  {
    name: 'Glowing',
    icon: '✨',
    minPoints: 500,
    multiplier: '1.25x',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    benefits: ['1.25x points on purchases', 'Birthday gift', 'Early access to sales'],
  },
  {
    name: 'Radiant',
    icon: '💫',
    minPoints: 1500,
    multiplier: '1.5x',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    benefits: ['1.5x points on purchases', 'Free shipping on orders', 'Exclusive products'],
  },
  {
    name: 'Glass Skin',
    icon: '💎',
    minPoints: 5000,
    multiplier: '2x',
    color: 'bg-violet-100 text-violet-800 border-violet-200',
    benefits: ['2x points on purchases', 'VIP customer support', 'First access to new products', 'Exclusive gifts'],
  },
]

const earnWays = [
  { action: 'Create account', points: 100, icon: '🎁', frequency: 'Once' },
  { action: 'Complete profile', points: 50, icon: '📝', frequency: 'Once' },
  { action: 'Make a purchase', points: '1pt/TND', icon: '🛍️', frequency: 'Every order' },
  { action: 'Write a review', points: 50, icon: '⭐', frequency: 'Per product' },
  { action: 'Add photo to review', points: '+25', icon: '📸', frequency: 'Per review' },
  { action: 'Refer a friend', points: 200, icon: '👯', frequency: 'Per referral' },
  { action: 'Daily check-in', points: 5, icon: '📅', frequency: 'Daily' },
  { action: 'Birthday bonus', points: 100, icon: '🎂', frequency: 'Yearly' },
]

const sampleRewards = [
  { name: 'Free Sample', points: 100, icon: '🧴' },
  { name: '10 TND Off', points: 250, icon: '💰' },
  { name: '25 TND Off', points: 500, icon: '💵' },
  { name: 'Sheet Mask Set', points: 750, icon: '🎭' },
  { name: 'Travel Size Product', points: 1000, icon: '✈️' },
  { name: '50 TND Off', points: 2000, icon: '🎉' },
]

export const RewardsLandingPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [isJoining, setIsJoining] = useState(false)
  const [referralCode, setReferralCode] = useState('')

  const handleJoin = async () => {
    if (!user) {
      router.push('/create-account?redirect=/rewards')
      return
    }

    setIsJoining(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referralCode: referralCode || undefined }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Welcome to Glow Rewards! You earned ${data.points} bonus points!`)
        router.push('/account/rewards')
      } else {
        if (data.error === 'Already a rewards member') {
          router.push('/account/rewards')
        } else {
          toast.error(data.error || 'Failed to join rewards program')
        }
      }
    } catch (_error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-br from-rose-50 via-amber-50 to-violet-50 dark:from-rose-950/20 dark:via-amber-950/20 dark:to-violet-950/20">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-block mb-6 px-4 py-2 bg-white/80 dark:bg-white/10 rounded-full text-sm font-medium">
            ✨ Introducing Glow Rewards ✨
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 bg-gradient-to-r from-rose-600 via-amber-600 to-violet-600 bg-clip-text text-transparent">
            Your Journey to Glass Skin Starts Here
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join our rewards program and earn points with every purchase.
            Unlock exclusive benefits, free products, and achieve your skincare goals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Referral code (optional)"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="px-4 py-3 rounded-full border bg-white dark:bg-black/20 w-48"
              />
              <Button
                size="lg"
                onClick={handleJoin}
                disabled={isJoining}
                className="rounded-full px-8"
              >
                {isJoining ? 'Joining...' : user ? 'Join Now - Get 100 Points!' : 'Sign Up & Join'}
              </Button>
            </div>
          </div>

          {user?.rewardsEnabled && (
            <div className="mt-6">
              <Button variant="outline" asChild className="rounded-full">
                <Link href="/account/rewards">Go to My Rewards →</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Tiers Section */}
      <section className="py-16 px-4 bg-white dark:bg-black/20">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
            Climb the Glow Ladder
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            The more you shop, the higher you climb. Each tier unlocks exclusive benefits
            on your journey to glass skin perfection.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative p-6 rounded-2xl border-2 ${tier.color} transition-transform hover:scale-105`}
              >
                <div className="text-4xl mb-3">{tier.icon}</div>
                <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                <p className="text-sm opacity-75 mb-3">
                  {tier.minPoints === 0 ? 'Starting tier' : `${tier.minPoints.toLocaleString()} points`}
                </p>
                <div className="inline-block px-3 py-1 bg-white/50 rounded-full text-sm font-semibold mb-4">
                  {tier.multiplier} Points
                </div>
                <ul className="space-y-2">
                  {tier.benefits.map((benefit, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ways to Earn Section */}
      <section className="py-16 px-4 bg-gradient-to-b from-white to-rose-50 dark:from-black/20 dark:to-rose-950/10">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
            Ways to Earn Points
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Points add up quickly! Here&apos;s how you can earn your way to amazing rewards.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {earnWays.map((way) => (
              <div
                key={way.action}
                className="p-5 bg-white dark:bg-black/40 rounded-xl border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-3">{way.icon}</div>
                <h3 className="font-semibold mb-1">{way.action}</h3>
                <p className="text-2xl font-bold text-primary mb-1">
                  {typeof way.points === 'number' ? `+${way.points}` : way.points}
                </p>
                <p className="text-xs text-muted-foreground">{way.frequency}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rewards Catalog Preview */}
      <section className="py-16 px-4 bg-white dark:bg-black/20">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
            Redeem Your Points
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Turn your points into amazing skincare rewards.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {sampleRewards.map((reward) => (
              <div
                key={reward.name}
                className="p-4 bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/20 dark:to-rose-950/20 rounded-xl text-center border hover:border-primary transition-colors"
              >
                <div className="text-3xl mb-2">{reward.icon}</div>
                <h3 className="font-medium text-sm mb-1">{reward.name}</h3>
                <p className="text-xs text-muted-foreground">{reward.points} pts</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" onClick={handleJoin} className="rounded-full">
              {user ? 'Join to See All Rewards' : 'Sign Up to Unlock Rewards'}
            </Button>
          </div>
        </div>
      </section>

      {/* Referral Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-violet-100 to-rose-100 dark:from-violet-950/30 dark:to-rose-950/30">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="text-5xl mb-4">👯‍♀️</div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Share the Glow
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Invite your friends to join Glow Rewards. When they make their first purchase,
            you&apos;ll both earn <span className="font-bold text-primary">200 bonus points</span>!
          </p>
          <Button size="lg" onClick={handleJoin} className="rounded-full px-8">
            {user ? 'Get Your Referral Code' : 'Join & Start Referring'}
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 bg-white dark:bg-black/20">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-serif font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'How do I join Glow Rewards?',
                a: 'Simply create an account or log in, then click "Join Now" on this page. You\'ll instantly earn 100 welcome points!',
              },
              {
                q: 'Do my points expire?',
                a: 'Points expire 12 months after they are earned if there is no account activity. Keep earning or redeeming to keep your points active!',
              },
              {
                q: 'How do I move up tiers?',
                a: 'Your tier is based on lifetime points earned. Keep shopping and earning to unlock higher tiers with better multipliers and benefits.',
              },
              {
                q: 'Can I use rewards with other promotions?',
                a: 'Yes! Rewards discounts can be combined with most other promotions and sales.',
              },
            ].map((faq) => (
              <div key={faq.q} className="p-6 bg-gray-50 dark:bg-white/5 rounded-xl">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-rose-500 to-violet-600 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Start Your Glow Journey Today
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Join thousands of skincare enthusiasts earning rewards on their path to glass skin.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={handleJoin}
            className="rounded-full px-10 text-lg"
          >
            {user ? 'Join Glow Rewards' : 'Create Account & Join'}
          </Button>
        </div>
      </section>
    </div>
  )
}
