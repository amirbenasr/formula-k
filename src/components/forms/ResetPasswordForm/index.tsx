'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Fragment, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  password: string
  passwordConfirm: string
}

export const ResetPasswordForm: React.FC = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const router = useRouter()
  const { resetPassword } = useAuth()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    watch,
  } = useForm<FormData>()

  const password = watch('password')

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!token) {
        setError('Missing reset token. Please request a new password reset link.')
        return
      }

      try {
        await resetPassword({
          password: data.password,
          passwordConfirm: data.passwordConfirm,
          token,
        })
        setSuccess(true)
        setError('')
      } catch (e) {
        setError(
          'There was a problem resetting your password. The link may have expired. Please try requesting a new one.',
        )
      }
    },
    [token, resetPassword],
  )

  if (!token) {
    return (
      <Fragment>
        <h1 className="text-xl mb-4">Invalid Reset Link</h1>
        <div className="prose dark:prose-invert">
          <p>
            This password reset link is invalid or has expired. Please{' '}
            <Link href="/forgot-password">request a new password reset</Link>.
          </p>
        </div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      {!success && (
        <Fragment>
          <h1 className="text-xl mb-4">Reset Your Password</h1>
          <div className="prose dark:prose-invert mb-8">
            <p>Enter your new password below.</p>
          </div>
          <form className="max-w-lg" onSubmit={handleSubmit(onSubmit)}>
            <Message className="mb-8" error={error} />

            <FormItem className="mb-8">
              <Label htmlFor="password" className="mb-2">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                {...register('password', {
                  required: 'Please enter a new password.',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters.',
                  },
                })}
              />
              {errors.password && <FormError message={errors.password.message} />}
            </FormItem>

            <FormItem className="mb-8">
              <Label htmlFor="passwordConfirm" className="mb-2">
                Confirm New Password
              </Label>
              <Input
                id="passwordConfirm"
                type="password"
                {...register('passwordConfirm', {
                  required: 'Please confirm your password.',
                  validate: (value) => value === password || 'Passwords do not match.',
                })}
              />
              {errors.passwordConfirm && <FormError message={errors.passwordConfirm.message} />}
            </FormItem>

            <Button type="submit" variant="default" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </Fragment>
      )}
      {success && (
        <Fragment>
          <h1 className="text-xl mb-4">Password Reset Successfully</h1>
          <div className="prose dark:prose-invert mb-8">
            <p>Your password has been reset. You can now log in with your new password.</p>
          </div>
          <Button asChild variant="default">
            <Link href="/login">Go to Login</Link>
          </Button>
        </Fragment>
      )}
    </Fragment>
  )
}
