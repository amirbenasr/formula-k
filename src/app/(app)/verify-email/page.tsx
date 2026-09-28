import type { Metadata } from 'next'

import { VerifyEmailForm } from '@/components/forms/VerifyEmailForm'
import React, { Suspense } from 'react'

function VerifyEmailContent() {
  return <VerifyEmailForm />
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}

export const metadata: Metadata = {
  description: 'Vérification de votre adresse e-mail Formula K.',
  openGraph: {
    title: 'Vérification de l’e-mail',
    url: '/verify-email',
  },
  title: 'Vérification de l’e-mail',
}
