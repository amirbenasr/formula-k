import type { Metadata } from 'next'

import { AuthLink, AuthShell } from '@/components/auth/AuthShell'
import { CreateAccountForm } from '@/components/forms/CreateAccountForm'
import { RenderParams } from '@/components/RenderParams'
import configPromise from '@payload-config'
import { UserPlus } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function CreateAccount() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/account?warning=${encodeURIComponent('Vous êtes déjà connecté.')}`)
  }

  return (
    <AuthShell
      description="Suivez vos commandes, enregistrez vos adresses et cumulez des points Glow Rewards."
      footer={
        <>
          Déjà client ? <AuthLink href="/login">Se connecter</AuthLink>
        </>
      }
      icon={UserPlus}
      title="Créer un compte"
    >
      <RenderParams />
      <CreateAccountForm />
    </AuthShell>
  )
}

export const metadata: Metadata = {
  description: 'Créez votre compte Formula K pour suivre vos commandes.',
  openGraph: {
    title: 'Créer un compte',
    url: '/create-account',
  },
  title: 'Créer un compte',
}
