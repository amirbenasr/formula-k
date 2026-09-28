'use client'

import { AuthLink, AuthShell } from '@/components/auth/AuthShell'
import { useAuth } from '@/providers/Auth'
import { LogOut } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export const LogoutPage: React.FC = () => {
  const { logout } = useAuth()
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout()
        setSuccess('Vous êtes déconnecté.')
      } catch (_) {
        setError('Vous êtes déjà déconnecté.')
      }
    }

    void performLogout()
  }, [logout])

  const title = error || success

  if (!title) return null

  return (
    <AuthShell
      description="Merci de votre visite, à très bientôt chez Formula K."
      footer={
        <>
          Vous voulez revenir ? <AuthLink href="/login">Se connecter</AuthLink>
        </>
      }
      icon={LogOut}
      title={title}
    >
      <p className="text-sm text-muted">
        Vous pouvez continuer vos achats quand vous le souhaitez.
      </p>
    </AuthShell>
  )
}
