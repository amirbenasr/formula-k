import type { Metadata } from 'next'

import { AuthLink, AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm'
import { KeyRound } from 'lucide-react'
import React from 'react'

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      footer={
        <>
          Vous vous en souvenez ? <AuthLink href="/login">Retour à la connexion</AuthLink>
        </>
      }
      icon={KeyRound}
      title="Mot de passe oublié"
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}

export const metadata: Metadata = {
  description: 'Recevez un lien pour réinitialiser votre mot de passe Formula K.',
  openGraph: {
    title: 'Mot de passe oublié',
    url: '/forgot-password',
  },
  title: 'Mot de passe oublié',
}
