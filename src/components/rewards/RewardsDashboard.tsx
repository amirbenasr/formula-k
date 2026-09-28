'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Copy,
  Flame,
  Gem,
  Sparkles,
  Sprout,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

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

interface RewardsError {
  message: string
  needsLogin: boolean
}

/**
 * Montants affichés dans la copie. Ils doivent rester alignés sur les valeurs
 * réellement appliquées côté serveur :
 * - 100 points de bienvenue : `/api/rewards/join`
 * - 200 points de parrainage : `REWARD_POINTS.referral` dans `@/utilities/rewards`
 * - 5 points par pointage : `CHECKIN_POINTS` dans `/api/rewards/checkin`
 */
const WELCOME_POINTS = 100
const REFERRAL_POINTS = 200
const CHECKIN_POINTS = 5

/** Séparateur de milliers déterministe (espace insécable), identique au reste du site. */
const formatPoints = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')

/** Affiche un multiplicateur à la française (1.25 devient 1,25). */
const formatMultiplier = (value: number) => String(value).replace('.', ',')

/**
 * Libellés français des actions enregistrées en base (colonne `action`).
 * Toute action inconnue retombe sur sa valeur brute.
 */
const actionLabels: Record<string, string> = {
  welcome: 'Bonus de bienvenue',
  profile_complete: 'Profil complété',
  purchase: 'Achat',
  review: 'Avis laissé',
  review_photo: 'Avis avec photo',
  referral: 'Parrainage',
  birthday: 'Bonus d’anniversaire',
  social_follow: 'Suivi sur les réseaux',
  checkin: 'Pointage du jour',
  challenge: 'Défi relevé',
  redemption: 'Récompense échangée',
}

/**
 * Les paliers stockent leur icône en base sous forme d'emoji (voir la route
 * `/api/rewards/seed`). On la convertit en icône lucide ; une valeur vide ou
 * inconnue retombe sur Sparkles, pour ne jamais afficher d'emoji brut.
 */
const tierIcons: Record<string, LucideIcon> = {
  '\u{1F331}': Sprout, // U+1F331 seedling
  '\u{2728}': Sparkles, // U+2728 sparkles
  '\u{1F4AB}': Star, // U+1F4AB dizzy
  '\u{1F48E}': Gem, // U+1F48E gem stone
  sprout: Sprout,
  sparkles: Sparkles,
  star: Star,
  gem: Gem,
  diamond: Gem,
}

const resolveTierIcon = (icon?: string | null): LucideIcon => {
  if (!icon) return Sparkles
  const key = icon.trim()
  return tierIcons[key] ?? tierIcons[key.toLowerCase()] ?? Sparkles
}

/**
 * Les avantages sont du contenu éditable (collection RewardTiers). On traduit
 * les libellés du seed et, si l'admin a modifié le texte, on affiche la valeur
 * telle quelle : jamais de contenu inventé.
 */
const benefitLabels: Record<string, string> = {
  'Earn 1 point per 1 TND spent': '1 point par tranche de 1 TND dépensée',
  'Access to rewards catalog': 'Accès au catalogue de récompenses',
  'Birthday bonus points': 'Points bonus le jour de votre anniversaire',
  '1.25x points on all purchases': '1,25x points sur tous vos achats',
  'Birthday gift': 'Cadeau d’anniversaire',
  'Early access to sales': 'Accès anticipé aux soldes',
  'Exclusive member-only offers': 'Offres exclusives réservées aux membres',
  '1.5x points on all purchases': '1,5x points sur tous vos achats',
  'Free shipping on all orders': 'Livraison offerte sur toutes vos commandes',
  'Early access to new products': 'Accès anticipé aux nouveautés',
  'Exclusive products access': 'Accès aux produits exclusifs',
  'Priority customer support': 'Service client prioritaire',
  '2x points on all purchases': '2x points sur tous vos achats',
  'Free express shipping': 'Livraison express offerte',
  'First access to everything': 'Accès prioritaire à tout',
  'Exclusive VIP gifts': 'Cadeaux VIP exclusifs',
  'Dedicated VIP support': 'Accompagnement VIP dédié',
  'Annual appreciation gift': 'Cadeau annuel de remerciement',
}

export const RewardsDashboard: React.FC = () => {
  const [data, setData] = useState<RewardsData | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<RewardsError | null>(null)
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

      // Un invité reçoit un 401 : on affiche un vrai état d'erreur plutôt que
      // de faire passer la réponse pour un solde de points.
      if (!balanceRes.ok || !catalogRes.ok || balanceData?.error) {
        setData(null)
        setRewards([])
        setError(
          balanceRes.status === 401
            ? {
                message:
                  'Votre session a expiré. Connectez-vous pour consulter vos points Glow Rewards.',
                needsLogin: true,
              }
            : {
                message:
                  'Impossible de charger vos récompenses pour le moment. Réessayez dans un instant.',
                needsLogin: false,
              },
        )
        return
      }

      setError(null)
      setData(balanceData)
      setRewards(catalogData.rewards || [])
    } catch (error) {
      setData(null)
      setRewards([])
      setError({
        message: 'Impossible de charger vos récompenses pour le moment. Réessayez dans un instant.',
        needsLogin: false,
      })
      console.log(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    fetchData()
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/rewards/checkin`, {
        method: 'POST',
        credentials: 'include',
      })

      const result = await response.json()

      if (response.ok) {
        const earned =
          typeof result.pointsEarned === 'number' ? result.pointsEarned : CHECKIN_POINTS
        toast.success(
          result.streakBonus ? `+${earned} points, bonus de série inclus !` : `+${earned} points !`,
        )
        fetchData()
      } else {
        toast.error('Le pointage a échoué. Réessayez dans un instant.')
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
      console.log(error)
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
        toast.success('Récompense échangée !')
        if (result.redemptionCode) {
          toast.success(`Votre code : ${result.redemptionCode}`, { duration: 10000 })
        }
        fetchData()
      } else {
        toast.error('L’échange a échoué. Réessayez dans un instant.')
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
      console.log(error)
    } finally {
      setRedeeming(null)
    }
  }

  const copyReferralCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode)
      setCopied(true)
      toast.success('Code de parrainage copié !')
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

  if (error) {
    return (
      <div className="surface surface-pad flex flex-col items-center text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
          <CircleAlert className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-serif text-2xl font-medium text-foreground">
          Récompenses indisponibles
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted">{error.message}</p>
        <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button onClick={handleRetry} className="w-full sm:w-auto">
            Réessayer
          </Button>
          {error.needsLogin && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/login">Se connecter</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (!data?.isRewardsMember) {
    return (
      <div className="surface surface-pad flex flex-col items-center text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-serif text-2xl font-medium text-foreground">
          Rejoignez Glow Rewards
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          Vous n’êtes pas encore membre du programme de fidélité. Adhérez maintenant et recevez{' '}
          {WELCOME_POINTS} points de bienvenue.
        </p>
        <Button asChild className="mt-6 w-full sm:w-auto">
          <Link href="/rewards">Rejoindre le programme</Link>
        </Button>
      </div>
    )
  }

  const progressToNextTier = data.nextTier
    ? ((data.lifetimePoints - (data.nextTier.minPoints - data.nextTier.pointsToReach)) /
        data.nextTier.minPoints) *
      100
    : 100

  const TierIcon = resolveTierIcon(data.tier?.icon)

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Solde de points, palier et progression */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <div className="surface surface-pad lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Points disponibles
              </p>
              <p className="mt-2 text-4xl font-semibold text-foreground sm:text-5xl">
                {formatPoints(data.points)}
              </p>
            </div>

            {data.tier && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
                  <TierIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Palier actuel
                  </p>
                  <p className="mt-1 text-lg font-medium text-foreground">{data.tier.name}</p>
                  <p className="text-sm font-medium text-primary-ink">
                    {formatMultiplier(data.tier.pointsMultiplier)}x points
                  </p>
                </div>
              </div>
            )}
          </div>

          {data.nextTier && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between gap-2 text-sm text-muted">
                <span>Progression vers {data.nextTier.name}</span>
                <span className="text-right">
                  Encore {formatPoints(data.nextTier.pointsToReach)} points
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary/40">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(progressToNextTier, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pointage du jour */}
        <div className="surface surface-pad flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-medium text-foreground">Pointage du jour</h3>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted">
            {data.checkInStreak > 0 ? (
              <>
                {data.checkInStreak} {data.checkInStreak > 1 ? 'jours' : 'jour'} d’affilée
                <Flame className="h-4 w-4 text-primary-ink" />
              </>
            ) : (
              'Lancez votre série !'
            )}
          </p>
          <Button
            onClick={handleCheckIn}
            disabled={checkingIn || !canCheckIn()}
            variant={canCheckIn() ? 'default' : 'outline'}
            className="mt-4 w-full"
          >
            {checkingIn
              ? 'Pointage…'
              : canCheckIn()
                ? `+${CHECKIN_POINTS} points`
                : 'Revenez demain !'}
          </Button>
        </div>
      </div>

      {/* Parrainage */}
      <div className="surface surface-pad">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Partagez votre éclat</h3>
              <p className="mt-1 text-sm text-muted">
                Invitez vos amies : dès leur première commande, vous recevez {REFERRAL_POINTS}{' '}
                points de parrainage.
              </p>
              <p className="mt-1 text-sm text-muted">
                Vous avez parrainé{' '}
                <span className="font-semibold text-foreground">{data.referralCount}</span>{' '}
                {data.referralCount === 1 ? 'amie' : 'amies'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-full border border-border bg-secondary/40 px-4 py-2.5 font-mono font-semibold text-foreground">
              {data.referralCode}
            </div>
            <Button
              variant="outline"
              onClick={copyReferralCode}
              aria-label="Copier le code de parrainage"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copié' : 'Copier'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Catalogue de récompenses */}
      <section>
        <div className="mb-4 sm:mb-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Catalogue de récompenses
          </span>
          <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
            Échangez vos points
          </h2>
        </div>

        {rewards.length === 0 ? (
          <p className="surface surface-pad text-center text-sm text-muted">
            Aucune récompense n’est disponible pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((reward) => {
              const canAfford = data.points >= reward.pointsCost
              const isRedeeming = redeeming === reward.id
              const isAvailable = canAfford && reward.isAvailable

              return (
                <div
                  key={reward.id}
                  className={`surface surface-pad flex flex-col gap-2 transition-colors ${
                    isAvailable ? 'hover:border-primary/40' : 'opacity-60'
                  }`}
                >
                  {reward.isFeatured && (
                    <span className="badge w-fit gap-1 bg-accent/10 text-accent">
                      <Star className="h-3.5 w-3.5" />
                      Coup de cœur
                    </span>
                  )}
                  <h3 className="font-medium text-foreground">{reward.name}</h3>
                  {reward.description && <p className="text-sm text-muted">{reward.description}</p>}

                  <div className="mt-auto flex flex-col gap-3 pt-3">
                    <span className="text-lg font-semibold text-primary-ink">
                      {formatPoints(reward.pointsCost)} pts
                    </span>
                    <Button
                      variant={canAfford ? 'default' : 'outline'}
                      disabled={!canAfford || !reward.isAvailable || isRedeeming}
                      onClick={() => handleRedeem(reward.id)}
                      className="w-full"
                    >
                      {isRedeeming
                        ? 'Échange en cours…'
                        : !reward.isAvailable
                          ? 'Épuisé'
                          : canAfford
                            ? 'Échanger'
                            : 'Points insuffisants'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Activité récente */}
      <section>
        <div className="mb-4 sm:mb-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Historique
          </span>
          <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
            Activité récente
          </h2>
        </div>

        {data.recentTransactions.length > 0 ? (
          <div className="surface surface-pad divide-y divide-border">
            {data.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {actionLabels[transaction.action] || transaction.action}
                  </p>
                  <p className="text-sm text-muted">
                    {new Date(transaction.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-lg font-semibold ${
                    transaction.points > 0 ? 'text-accent' : 'text-destructive'
                  }`}
                >
                  {transaction.points > 0 ? '+' : ''}
                  {transaction.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="surface surface-pad text-center text-sm text-muted">
            Aucune activité pour le moment. Commencez à cumuler des points !
          </p>
        )}

        <div className="mt-6 flex justify-center">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/account/rewards/history">Voir tout l’historique</Link>
          </Button>
        </div>
      </section>

      {/* Avantages du palier */}
      {data.tier && (
        <section>
          <div className="mb-4 sm:mb-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Votre palier
            </span>
            <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
              Vos avantages {data.tier.name}
            </h2>
          </div>

          <div className="surface surface-pad">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {data.tier.benefits?.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-sm text-foreground">
                    {benefitLabels[b.benefit] ?? b.benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
