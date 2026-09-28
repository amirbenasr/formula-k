import type { Metadata } from 'next'

import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm'
import React, { Suspense } from 'react'

function ResetPasswordContent() {
  return <ResetPasswordForm />
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}

export const metadata: Metadata = {
  description: 'Choisissez un nouveau mot de passe pour votre compte Formula K.',
  openGraph: {
    title: 'Nouveau mot de passe',
    url: '/reset-password',
  },
  title: 'Nouveau mot de passe',
}
