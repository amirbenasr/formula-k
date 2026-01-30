'use client'

import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { Fragment, useCallback, useEffect, useState } from 'react'

export const VerifyEmailForm: React.FC = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  const verifyEmail = useCallback(async () => {
    if (!token) {
      setError('Missing verification token.')
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
        setError(data?.errors?.[0]?.message || 'Verification failed. The link may have expired.')
      }
    } catch (e) {
      setError('There was a problem verifying your email. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    verifyEmail()
  }, [verifyEmail])

  if (!token) {
    return (
      <Fragment>
        <h1 className="text-xl mb-4">Invalid Verification Link</h1>
        <div className="prose dark:prose-invert">
          <p>
            This email verification link is invalid. Please check your email for the correct link or{' '}
            <Link href="/login">login to your account</Link> to request a new verification email.
          </p>
        </div>
      </Fragment>
    )
  }

  if (loading) {
    return (
      <Fragment>
        <h1 className="text-xl mb-4">Verifying Your Email</h1>
        <div className="prose dark:prose-invert">
          <p>Please wait while we verify your email address...</p>
        </div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      {!success && (
        <Fragment>
          <h1 className="text-xl mb-4">Verification Failed</h1>
          <Message className="mb-8" error={error} />
          <div className="prose dark:prose-invert mb-8">
            <p>
              The verification link may have expired or already been used. Please{' '}
              <Link href="/login">login to your account</Link> to request a new verification email.
            </p>
          </div>
        </Fragment>
      )}
      {success && (
        <Fragment>
          <h1 className="text-xl mb-4">Email Verified Successfully!</h1>
          <div className="prose dark:prose-invert mb-8">
            <p>
              Your email has been verified. You can now access all features of your account.
            </p>
          </div>
          <Button asChild variant="default">
            <Link href="/login">Go to Login</Link>
          </Button>
        </Fragment>
      )}
    </Fragment>
  )
}
