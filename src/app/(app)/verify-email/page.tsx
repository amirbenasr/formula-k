import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React, { Suspense } from 'react'

import { VerifyEmailForm } from '@/components/forms/VerifyEmailForm'

function VerifyEmailContent() {
  return <VerifyEmailForm />
}

export default function VerifyEmailPage() {
  return (
    <div className="container py-16">
      <Suspense fallback={<div>Verifying your email...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Verify your email address.',
  openGraph: mergeOpenGraph({
    title: 'Verify Email',
    url: '/verify-email',
  }),
  title: 'Verify Email',
}
