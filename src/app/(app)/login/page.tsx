import type { Metadata } from 'next'

import { AuthLink, AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/forms/LoginForm'
import { RenderParams } from '@/components/RenderParams'
import configPromise from '@payload-config'
import { LogIn } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function Login() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/account?warning=${encodeURIComponent('Vous êtes déjà connecté.')}`)
  }

  return (
    <AuthShell
      description="Connectez-vous pour suivre vos commandes et vos points Glow Rewards."
      footer={
        <>
          Pas encore de compte ? <AuthLink href="/create-account">Créer un compte</AuthLink>
        </>
      }
      icon={LogIn}
      title="Connexion"
    >
      <RenderParams />
      <LoginForm />
    </AuthShell>
  )
}

export const metadata: Metadata = {
  description: 'Connectez-vous à votre compte Formula K.',
  openGraph: {
    title: 'Connexion',
    url: '/login',
  },
  title: 'Connexion',
}
