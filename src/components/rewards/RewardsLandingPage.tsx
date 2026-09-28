'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/providers/Auth'
import {
  ArrowRight,
  CakeSlice,
  CalendarDays,
  Camera,
  Check,
  Droplets,
  Gem,
  Gift,
  Pencil,
  Plane,
  ShoppingBag,
  Sparkles,
  Sprout,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

/** Deterministic French thousands separator (non-breaking space), so server and client markup match. */
const formatPoints = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')

const referralPlaceholder = 'Code de parrainage (facultatif)'

type Tier = {
  name: string
  icon: LucideIcon
  minPoints: number
  multiplier: string
  chipClass: string
  popular?: boolean
  benefits: string[]
}

const tiers: Tier[] = [
  {
    name: 'Éveil',
    icon: Sprout,
    minPoints: 0,
    multiplier: 'x1',
    chipClass: 'bg-primary/10 text-primary-ink',
    benefits: [
      '1 point par tranche de 1 TND dépensée',
      'Accès au catalogue de récompenses',
      'Cadeau d’anniversaire',
    ],
  },
  {
    name: 'Éclat',
    icon: Sparkles,
    minPoints: 500,
    multiplier: 'x1,25',
    chipClass: 'bg-accent/10 text-accent',
    popular: true,
    benefits: [
      '1,25x points sur vos achats',
      'Cadeau d’anniversaire offert',
      'Accès anticipé aux soldes',
    ],
  },
  {
    name: 'Radieuse',
    icon: Gem,
    minPoints: 1500,
    multiplier: 'x1,5',
    chipClass: 'bg-primary/10 text-primary-ink',
    benefits: ['1,5x points sur vos achats', 'Livraison offerte', 'Produits exclusifs'],
  },
  {
    name: 'Peau de verre',
    icon: Droplets,
    minPoints: 5000,
    multiplier: 'x2',
    chipClass: 'bg-accent/10 text-accent',
    benefits: [
      '2x points sur vos achats',
      'Service client VIP',
      'Accès prioritaire aux nouveautés',
      'Cadeaux exclusifs',
    ],
  },
]

const earnWays: {
  action: string
  points: number | string
  icon: LucideIcon
  frequency: string
  chipClass: string
}[] = [
  {
    action: 'Créer un compte',
    points: 100,
    icon: Gift,
    frequency: 'Une seule fois',
    chipClass: 'bg-primary/10 text-primary-ink',
  },
  {
    action: 'Compléter mon profil',
    points: 50,
    icon: Pencil,
    frequency: 'Une seule fois',
    chipClass: 'bg-accent/10 text-accent',
  },
  {
    action: 'Passer une commande',
    points: '1 pt / TND',
    icon: ShoppingBag,
    frequency: 'À chaque commande',
    chipClass: 'bg-primary/10 text-primary-ink',
  },
  {
    action: 'Laisser un avis',
    points: 50,
    icon: Star,
    frequency: 'Par produit',
    chipClass: 'bg-accent/10 text-accent',
  },
  {
    action: 'Ajouter une photo à un avis',
    points: 25,
    icon: Camera,
    frequency: 'Par avis',
    chipClass: 'bg-primary/10 text-primary-ink',
  },
  {
    action: 'Parrainer une amie',
    points: 200,
    icon: Users,
    frequency: 'Par parrainage',
    chipClass: 'bg-accent/10 text-accent',
  },
  {
    action: 'Pointage quotidien',
    points: 5,
    icon: CalendarDays,
    frequency: 'Chaque jour',
    chipClass: 'bg-primary/10 text-primary-ink',
  },
  {
    action: 'Cadeau d’anniversaire',
    points: 100,
    icon: CakeSlice,
    frequency: 'Chaque année',
    chipClass: 'bg-accent/10 text-accent',
  },
]

const sampleRewards: { name: string; points: number; icon: LucideIcon; chipClass: string }[] = [
  {
    name: 'Échantillon offert',
    points: 100,
    icon: Sprout,
    chipClass: 'bg-primary/10 text-primary-ink',
  },
  { name: '10 TND de remise', points: 250, icon: Tag, chipClass: 'bg-accent/10 text-accent' },
  {
    name: '25 TND de remise',
    points: 500,
    icon: Gift,
    chipClass: 'bg-primary/10 text-primary-ink',
  },
  {
    name: 'Coffret de masques',
    points: 750,
    icon: Droplets,
    chipClass: 'bg-accent/10 text-accent',
  },
  { name: 'Format voyage', points: 1000, icon: Plane, chipClass: 'bg-primary/10 text-primary-ink' },
  { name: '50 TND de remise', points: 2000, icon: Sparkles, chipClass: 'bg-accent/10 text-accent' },
]

const faqs = [
  {
    q: 'Comment rejoindre Glow Rewards ?',
    a: 'Créez un compte ou connectez-vous, puis cliquez sur « Rejoindre » depuis cette page. Vous gagnez immédiatement 100 points de bienvenue.',
  },
  {
    q: 'Mes points expirent-ils ?',
    a: 'Les points expirent 12 mois après avoir été gagnés si votre compte reste inactif. Continuez à cumuler ou à échanger vos points pour les garder actifs.',
  },
  {
    q: 'Comment passer au palier supérieur ?',
    a: 'Votre palier dépend du total de points cumulés depuis votre inscription. Continuez à commander pour débloquer les paliers supérieurs, avec de meilleurs multiplicateurs et plus d’avantages.',
  },
  {
    q: 'Puis-je cumuler mes récompenses avec d’autres promotions ?',
    a: 'Oui, les remises de fidélité se cumulent avec la plupart des promotions et des soldes en cours.',
  },
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
        toast.success(`Bienvenue dans Glow Rewards ! Vous gagnez ${data.points} points bonus.`)
        router.push('/account/rewards')
      } else {
        if (data.error === 'Already a rewards member') {
          router.push('/account/rewards')
        } else {
          toast.error(data.error || 'Impossible de rejoindre le programme de fidélité.')
        }
      }
    } catch (_error) {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/15 via-background to-accent/10">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center sm:gap-6">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-ink">
              <Sparkles className="h-3.5 w-3.5" />
              Découvrez Glow Rewards
            </span>

            <h1 className="font-serif text-3xl font-medium leading-tight text-foreground sm:text-5xl">
              Votre rituel vers une peau de verre commence ici
            </h1>

            <p className="max-w-2xl text-base text-muted sm:text-lg">
              Rejoignez notre programme de fidélité et gagnez des points à chaque commande.
              Débloquez des avantages exclusifs, des produits offerts et atteignez vos objectifs
              beauté.
            </p>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Input
                type="text"
                placeholder={referralPlaceholder}
                aria-label={referralPlaceholder}
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="w-full bg-card sm:w-72"
              />
              <Button
                size="lg"
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full sm:w-auto"
              >
                {isJoining
                  ? 'Inscription…'
                  : user
                    ? 'Rejoindre et gagner 100 points'
                    : 'S’inscrire et rejoindre'}
              </Button>
            </div>

            {user?.rewardsEnabled && (
              <Button variant="ghost" asChild>
                <Link href="/account/rewards">
                  Voir mes points
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Paliers */}
      <section className="bg-card">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 text-center sm:mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Paliers de fidélité
            </span>
            <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
              Grimpez les paliers Glow
            </h2>
            <p className="text-sm text-muted sm:text-base">
              Plus vous commandez, plus vous montez. Chaque palier débloque des avantages exclusifs
              sur la route d’une peau de verre.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => {
              const Icon = tier.icon
              return (
                <div
                  key={tier.name}
                  className={`surface surface-pad flex flex-col gap-4 ${
                    tier.popular ? 'border-primary ring-1 ring-primary/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tier.chipClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {tier.popular ? (
                      <span className="badge bg-primary text-primary-foreground">
                        Le plus populaire
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="font-serif text-xl font-medium text-foreground">{tier.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {tier.minPoints === 0
                        ? 'Palier de départ'
                        : `${formatPoints(tier.minPoints)} points`}
                    </p>
                  </div>

                  <span className="badge w-fit bg-secondary/40 text-foreground">
                    Points {tier.multiplier}
                  </span>

                  <ul className="flex flex-col gap-2">
                    {tier.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-sm text-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Façons de gagner */}
      <section className="bg-secondary/40">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 text-center sm:mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Cumuler des points
            </span>
            <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
              Façons de gagner des points
            </h2>
            <p className="text-sm text-muted sm:text-base">
              Les points s’accumulent vite. Voici comment atteindre vos récompenses préférées.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {earnWays.map((way) => {
              const Icon = way.icon
              return (
                <div
                  key={way.action}
                  className="surface surface-pad flex flex-col items-start gap-3"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${way.chipClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-foreground">{way.action}</h3>
                  <p className="text-2xl font-semibold text-primary-ink">
                    {typeof way.points === 'number' ? `+${way.points}` : way.points}
                  </p>
                  <p className="text-xs text-muted">{way.frequency}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="bg-card">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 text-center sm:mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Catalogue de récompenses
            </span>
            <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
              Échangez vos points
            </h2>
            <p className="text-sm text-muted sm:text-base">
              Transformez vos points en récompenses beauté, sans minimum de commande.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
            {sampleRewards.map((reward) => {
              const Icon = reward.icon
              return (
                <div
                  key={reward.name}
                  className="surface surface-pad flex flex-col items-center gap-3 text-center"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${reward.chipClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground">{reward.name}</h3>
                  <p className="text-xs text-muted">{formatPoints(reward.points)} pts</p>
                </div>
              )
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <Button onClick={handleJoin} className="w-full sm:w-auto">
              {user ? 'Voir toutes les récompenses' : 'S’inscrire pour tout débloquer'}
            </Button>
          </div>
        </div>
      </section>

      {/* Parrainage */}
      <section className="bg-accent/10">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center sm:gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-accent">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
              Partagez votre éclat
            </h2>
            <p className="text-sm text-muted sm:text-base">
              Invitez vos amies à rejoindre Glow Rewards. Dès leur première commande, vous recevez
              chacune <span className="font-semibold text-primary-ink">200 points bonus</span>.
            </p>
            <Button size="lg" onClick={handleJoin} className="w-full sm:w-auto">
              {user ? 'Obtenir mon code de parrainage' : 'Rejoindre et parrainer'}
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center font-serif text-2xl font-medium text-foreground sm:mb-8 sm:text-3xl">
              Questions fréquentes
            </h2>

            <Accordion type="single" collapsible className="surface surface-pad">
              {faqs.map((faq) => (
                <AccordionItem key={faq.q} value={faq.q}>
                  <AccordionTrigger className="text-base font-medium text-foreground">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted sm:text-base">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary/10">
        <div className="container py-10 sm:py-14">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center sm:gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-primary-ink">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
              Commencez votre rituel Glow aujourd’hui
            </h2>
            <p className="text-sm text-muted sm:text-base">
              Rejoignez des milliers de passionnées de beauté qui cumulent des points sur la route
              d’une peau de verre.
            </p>
            <Button
              size="lg"
              onClick={handleJoin}
              disabled={isJoining}
              className="w-full sm:w-auto"
            >
              {user ? 'Rejoindre Glow Rewards' : 'Créer un compte et rejoindre'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
