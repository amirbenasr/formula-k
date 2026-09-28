'use client'

import { AuthShell } from '@/components/auth/AuthShell'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { MailCheck } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

export const VerifyEmailForm: React.FC = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  const verifyEmail = useCallback(async () => {
    if (!token) {
      setError('Jeton de vérification manquant.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/verify/${token}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (res.ok) {
        setSuccess(true)
        setError('')
      } else {
        const data = await res.json()
        setError(
          data?.errors?.[0]?.message || 'La vérification a échoué. Le lien a peut-être expiré.',
        )
      }
    } catch {
      setError('La vérification de votre e-mail a échoué. Merci de réessayer.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    verifyEmail()
  }, [verifyEmail])

  if (!token) {
    return (
      <AuthShell
        description="Ce lien de vérification est invalide. Ouvrez le lien reçu par e-mail ou connectez-vous pour en demander un nouveau."
        icon={MailCheck}
        title="Lien invalide"
      >
        <Button asChild className="w-full" size="lg">
          <Link href="/login">Se connecter</Link>
        </Button>
      </AuthShell>
    )
  }

  if (loading) {
    return (
      <AuthShell
        description="Vérification de votre adresse e-mail en cours…"
        icon={MailCheck}
        title="Vérification en cours"
      >
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      </AuthShell>
    )
  }

  if (!success) {
    return (
      <AuthShell
        description="Le lien de vérification a peut-être expiré ou a déjà été utilisé."
        icon={MailCheck}
        title="Vérification impossible"
      >
        <div className="flex flex-col gap-5">
          <Message error={error} />
          <Button asChild className="w-full" size="lg">
            <Link href="/login">Se connecter pour demander un nouveau lien</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description="Votre adresse e-mail est vérifiée. Vous pouvez accéder à toutes les fonctionnalités de votre compte."
      icon={MailCheck}
      title="E-mail vérifié"
    >
      <Button asChild className="w-full" size="lg">
        <Link href="/login">Se connecter</Link>
      </Button>
    </AuthShell>
  )
}
