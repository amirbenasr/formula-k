'use client'

import { AddressItem } from '@/components/addresses/AddressItem'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { FormItem } from '@/components/forms/FormItem'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Media } from '@/components/Media'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Address } from '@/payload-types'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { useAddresses, useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Banknote, ChevronDown, Info, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

/** Matches the "Livraison offerte dès 199 TND" claim in the header. */
const FREE_SHIPPING_FROM = 199

type CartData = ReturnType<typeof useCart>['cart']

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/**
 * A numbered step in the checkout. Everything a shopper has to fill in lives in
 * one of these, so the page reads as a short, obvious sequence instead of a
 * stack of unlabelled panels.
 */
const Step: React.FC<{
  children: React.ReactNode
  description?: string
  step: number
  title: string
}> = ({ children, description, step, title }) => (
  <section className="surface surface-pad">
    <header className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-semibold text-foreground">
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="font-serif text-xl leading-tight font-medium text-foreground sm:text-2xl">
          {title}
        </h2>
        {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
      </div>
    </header>
    {children}
  </section>
)

/**
 * Shared by the desktop sticky panel and the mobile collapsible summary, so the
 * two can never drift apart.
 */
const OrderSummaryContent: React.FC<{ cart: CartData }> = ({ cart }) => {
  const subtotal = cart?.subtotal || 0
  const remaining = FREE_SHIPPING_FROM - subtotal
  const items = cart?.items || []

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {items.map((item, index) => {
          if (typeof item.product !== 'object' || !item.product) return null

          const {
            product,
            product: { meta, title, gallery },
            quantity,
            variant,
          } = item

          if (!quantity) return null

          let image = gallery?.[0]?.image || meta?.image
          let price = product?.priceInUSD

          const isVariant = Boolean(variant) && typeof variant === 'object'

          if (isVariant) {
            price = variant?.priceInUSD

            const imageVariant = product.gallery?.find((galleryItem) => {
              if (!galleryItem.variantOption) return false
              const variantOptionID =
                typeof galleryItem.variantOption === 'object'
                  ? galleryItem.variantOption.id
                  : galleryItem.variantOption

              return variant?.options?.some((option) => {
                if (typeof option === 'object') return option.id === variantOptionID
                return option === variantOptionID
              })
            })

            if (imageVariant && typeof imageVariant.image !== 'string') {
              image = imageVariant.image
            }
          }

          return (
            <li className="flex items-start gap-3" key={item.id || index}>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/30 p-1.5">
                {image && typeof image !== 'string' ? (
                  <Media
                    className="relative h-full w-full"
                    fill
                    imgClassName="rounded-lg"
                    resource={image}
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm leading-snug font-medium text-foreground">
                    {title}
                  </p>
                  {variant && typeof variant === 'object' ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {variant.options
                        ?.map((option) => (typeof option === 'object' ? option.label : null))
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">Quantité : {quantity}</p>
                </div>
                {typeof price === 'number' ? (
                  <Price amount={price * quantity} className="shrink-0 text-sm font-medium" />
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {remaining > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-secondary/40 p-3 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-ink" />
          <span>
            Plus que <strong className="font-semibold text-foreground">{remaining} DT</strong> pour
            bénéficier de la livraison offerte.
          </span>
        </p>
      ) : null}

      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Sous-total</dt>
          <dd>
            <Price amount={subtotal} />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Livraison</dt>
          <dd className="text-muted">{remaining > 0 ? 'À régler à la livraison' : 'Offerte'}</dd>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
          <dt className="font-medium text-foreground">Total</dt>
          <dd>
            <Price amount={subtotal} className="text-xl font-semibold" />
          </dd>
        </div>
      </dl>
    </div>
  )
}

export const CheckoutPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const { cart, clearCart } = useCart()
  const [error, setError] = useState<null | string>(null)
  const [email, setEmail] = useState('')
  const { addresses } = useAddresses()
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [billingAddress, setBillingAddress] = useState<Partial<Address>>()
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [isProcessingOrder, setIsProcessingOrder] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const cartIsEmpty = !cart || !cart.items || !cart.items.length
  const itemCount = cart?.items?.reduce((total, item) => total + (item.quantity || 0), 0) || 0
  const subtotal = cart?.subtotal || 0

  /**
   * A guest can fill the rest of the form as soon as we have a plausible email.
   * This replaces the old "Continue as guest" button, which locked the rest of
   * the page behind a disabled-looking CTA.
   */
  const contactReady = Boolean(user || isEmail(email))

  const canPlaceOrder = Boolean(contactReady && billingAddress)

  // Prefill a default address for signed-in shoppers.
  useEffect(() => {
    if (!shippingAddress && !billingAddress && addresses && addresses.length > 0) {
      const defaultAddress = addresses[0]
      if (defaultAddress) {
        setBillingAddress(defaultAddress)
      }
    }
  }, [addresses, shippingAddress, billingAddress])

  useEffect(() => {
    return () => {
      setShippingAddress(undefined)
      setBillingAddress(undefined)
      setBillingAddressSameAsShipping(true)
      setEmail('')
    }
  }, [])

  const placeOrder = useCallback(async () => {
    if (!cart?.id) {
      setError('Panier introuvable.')
      return
    }

    setIsProcessingOrder(true)
    setError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/checkout/cod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cartId: cart.id,
          customerEmail: user?.email || email,
          userId: user?.id || null,
          billingAddress,
          shippingAddress: billingAddressSameAsShipping ? billingAddress : shippingAddress,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Impossible de valider la commande.')
      }

      clearCart()
      setOrderPlaced(true)

      toast.success('Commande confirmée !')

      if (data.pointsEarned && data.pointsEarned > 0) {
        setTimeout(() => {
          toast.success(`Vous avez gagné ${data.pointsEarned} points Glow Rewards !`, {
            duration: 5000,
          })
        }, 1000)
      }

      const customerEmail = user?.email || email
      const redirectUrl = `/orders/${data.orderId}${customerEmail ? `?email=${customerEmail}` : ''}`
      router.push(redirectUrl)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsProcessingOrder(false)
    }
  }, [
    cart?.id,
    user,
    email,
    billingAddress,
    shippingAddress,
    billingAddressSameAsShipping,
    clearCart,
    router,
  ])

  const summaryLabel = useMemo(
    () => `Récapitulatif (${itemCount} ${itemCount > 1 ? 'articles' : 'article'})`,
    [itemCount],
  )

  if (isProcessingOrder || orderPlaced) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-6 py-16 text-center">
        <h1 className="sr-only">Finaliser ma commande</h1>
        <p className="text-muted">
          {orderPlaced ? 'Commande confirmée, redirection…' : 'Validation de votre commande…'}
        </p>
        <LoadingSpinner />
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <ShoppingBag className="h-6 w-6 text-foreground" />
        </span>
        <h1 className="font-serif text-2xl font-medium text-foreground">Votre panier est vide</h1>
        <p className="text-sm text-muted">
          Ajoutez des produits à votre panier pour passer commande.
        </p>
        <Button asChild size="lg">
          <Link href="/shop">Découvrir la boutique</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-28 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        {/* ---------------- steps ---------------- */}
        <div className="flex flex-col gap-5 lg:order-1">
          <div>
            <h1 className="font-serif text-3xl font-medium text-foreground sm:text-4xl">
              Finaliser ma commande
            </h1>
            <p className="mt-2 text-sm text-muted">
              Paiement à la livraison partout en Tunisie — aucun paiement en ligne.
            </p>
          </div>

          <Step
            description={
              contactReady
                ? undefined
                : 'Renseignez votre e-mail pour continuer, ou connectez-vous à votre compte.'
            }
            step={1}
            title="Contact"
          >
            {user ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Connecté en tant que</p>
                  <p className="truncate font-medium text-foreground">{user.email}</p>
                </div>
                <Button asChild className="w-full sm:w-auto" size="sm" variant="outline">
                  <Link href="/logout">Se déconnecter</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <FormItem>
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input
                    autoComplete="email"
                    id="email"
                    inputMode="email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="vous@exemple.com"
                    required
                    type="email"
                    value={email}
                  />
                  <p className="text-xs text-muted">
                    La confirmation de commande sera envoyée à cette adresse.
                  </p>
                </FormItem>

                <p className="text-sm text-muted">
                  Vous avez déjà un compte ?{' '}
                  <Link className="font-medium text-primary-ink hover:underline" href="/login">
                    Se connecter
                  </Link>{' '}
                  ou{' '}
                  <Link
                    className="font-medium text-primary-ink hover:underline"
                    href="/create-account"
                  >
                    créer un compte
                  </Link>
                  .
                </p>
              </div>
            )}
          </Step>

          <Step
            description={
              contactReady ? undefined : 'Disponible dès que votre e-mail est renseigné.'
            }
            step={2}
            title={billingAddressSameAsShipping ? 'Adresse de livraison' : 'Adresses'}
          >
            <div
              className={cn(
                'flex flex-col gap-4',
                !contactReady && 'pointer-events-none opacity-50',
              )}
            >
              {billingAddress ? (
                <div className="rounded-xl border border-border bg-background p-4">
                  <AddressItem
                    actions={
                      <Button
                        disabled={isProcessingOrder}
                        onClick={(event) => {
                          event.preventDefault()
                          setBillingAddress(undefined)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Modifier
                      </Button>
                    }
                    address={billingAddress}
                  />
                </div>
              ) : user ? (
                <CheckoutAddresses
                  description="Choisissez une adresse enregistrée ou ajoutez-en une nouvelle."
                  heading="Vos adresses"
                  setAddress={setBillingAddress}
                />
              ) : (
                <div className="flex flex-wrap gap-3">
                  <CreateAddressModal
                    buttonText="Ajouter une adresse de livraison"
                    callback={(address) => {
                      setBillingAddress(address)
                    }}
                    disabled={!contactReady}
                    skipSubmission={true}
                  />
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                <Checkbox
                  checked={billingAddressSameAsShipping}
                  disabled={!contactReady}
                  id="shippingTheSameAsBilling"
                  onCheckedChange={(state) => {
                    setBillingAddressSameAsShipping(state as boolean)
                  }}
                />
                <Label className="cursor-pointer leading-snug" htmlFor="shippingTheSameAsBilling">
                  Utiliser la même adresse pour la livraison et la facturation
                </Label>
              </div>

              {!billingAddressSameAsShipping ? (
                shippingAddress ? (
                  <div className="rounded-xl border border-border bg-background p-4">
                    <AddressItem
                      actions={
                        <Button
                          disabled={isProcessingOrder}
                          onClick={(event) => {
                            event.preventDefault()
                            setShippingAddress(undefined)
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Modifier
                        </Button>
                      }
                      address={shippingAddress}
                    />
                  </div>
                ) : user ? (
                  <CheckoutAddresses
                    description="Choisissez l’adresse où nous devons livrer cette commande."
                    heading="Adresse de livraison"
                    setAddress={setShippingAddress}
                  />
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <CreateAddressModal
                      buttonText="Ajouter une adresse de livraison"
                      callback={(address) => {
                        setShippingAddress(address)
                      }}
                      disabled={!contactReady}
                      skipSubmission={true}
                    />
                  </div>
                )
              ) : null}
            </div>
          </Step>

          <Step step={3} title="Paiement">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                </span>
                <div>
                  <p className="font-medium text-foreground">Paiement à la livraison</p>
                  <p className="mt-1 text-sm text-muted">
                    Réglez en espèces au livreur à la réception de votre colis.
                  </p>
                </div>
              </div>

              <ul className="flex flex-col gap-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-primary-ink" />
                  Livraison en 24–48h partout en Tunisie
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary-ink" />
                  Produits 100% authentiques, sélectionnés en Corée
                </li>
                <li className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 shrink-0 text-primary-ink" />
                  Livraison offerte dès {FREE_SHIPPING_FROM} TND
                </li>
              </ul>
            </div>
          </Step>

          {error ? <Message error={error} /> : null}

          <div className="hidden flex-col gap-3 lg:flex">
            <Button
              className="w-full"
              disabled={!canPlaceOrder || isProcessingOrder}
              onClick={(event) => {
                event.preventDefault()
                void placeOrder()
              }}
              size="lg"
            >
              {isProcessingOrder ? 'Validation en cours…' : 'Confirmer la commande'}
            </Button>
            {!canPlaceOrder ? (
              <p className="text-center text-xs text-muted">
                {!contactReady
                  ? 'Renseignez votre e-mail pour continuer.'
                  : 'Ajoutez une adresse de livraison pour continuer.'}
              </p>
            ) : null}
          </div>
        </div>

        {/* ---------------- summary: mobile (collapsible, first) ---------------- */}
        <details
          className="surface order-first overflow-hidden lg:hidden"
          onToggle={(event) => setSummaryOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShoppingBag className="h-4 w-4 text-primary-ink" />
              {summaryLabel}
            </span>
            <span className="flex items-center gap-2">
              <Price amount={subtotal} className="font-semibold" />
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted transition-transform',
                  summaryOpen && 'rotate-180',
                )}
              />
            </span>
          </summary>
          <div className="border-t border-border p-4">
            <OrderSummaryContent cart={cart} />
          </div>
        </details>

        {/* ---------------- summary: desktop (sticky) ---------------- */}
        <aside className="surface surface-pad hidden lg:order-2 lg:sticky lg:top-24 lg:block lg:self-start">
          <h2 className="mb-5 font-serif text-xl font-medium text-foreground">Votre commande</h2>
          <OrderSummaryContent cart={cart} />
        </aside>
      </div>

      {/* ---------------- mobile sticky CTA ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="container flex items-center gap-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Total</p>
            <Price amount={subtotal} className="text-lg font-semibold" />
          </div>
          <Button
            className="shrink-0"
            disabled={!canPlaceOrder || isProcessingOrder}
            onClick={(event) => {
              event.preventDefault()
              void placeOrder()
            }}
            size="lg"
          >
            {isProcessingOrder ? 'Validation…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
