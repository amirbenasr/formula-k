'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
  passwordConfirm: string
}

export const CreateAccountForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const onSubmit = useCallback(async (data: FormData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users`, {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const result = await response.json()
        const message =
          result?.errors?.[0]?.message ||
          response.statusText ||
          'Une erreur est survenue lors de la création du compte.'
        setError(message)
        return
      }

      setSuccess(true)
    } catch (_) {
      setError('Une erreur est survenue lors de la création du compte. Merci de réessayer.')
    } finally {
      setLoading(false)
    }
  }, [])

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-xl font-medium text-foreground">Vérifiez votre e-mail</h2>
        <p className="text-sm text-muted">
          Votre compte a bien été créé. Nous vous avons envoyé un e-mail de vérification : cliquez
          sur le lien qu’il contient pour activer votre compte.
        </p>
        <p className="text-sm text-muted">
          Une fois votre adresse vérifiée, vous pourrez{' '}
          <Link
            className="font-medium text-primary-ink underline-offset-4 hover:underline"
            href={`/login${allParams}`}
          >
            vous connecter
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <Message error={error} />

      <FormItem>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          autoComplete="email"
          id="email"
          type="email"
          {...register('email', { required: 'Veuillez indiquer votre adresse e-mail.' })}
        />
        {errors.email ? <FormError message={errors.email.message} /> : null}
      </FormItem>

      <FormItem>
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          autoComplete="new-password"
          id="password"
          type="password"
          {...register('password', {
            required: 'Veuillez choisir un mot de passe.',
            minLength: {
              value: 8,
              message: 'Le mot de passe doit contenir au moins 8 caractères.',
            },
          })}
        />
        {errors.password ? <FormError message={errors.password.message} /> : null}
      </FormItem>

      <FormItem>
        <Label htmlFor="passwordConfirm">Confirmer le mot de passe</Label>
        <Input
          autoComplete="new-password"
          id="passwordConfirm"
          type="password"
          {...register('passwordConfirm', {
            required: 'Veuillez confirmer votre mot de passe.',
            validate: (value) =>
              value === password.current || 'Les mots de passe ne correspondent pas.',
          })}
        />
        {errors.passwordConfirm ? <FormError message={errors.passwordConfirm.message} /> : null}
      </FormItem>

      <Button className="w-full" disabled={loading} size="lg" type="submit">
        {loading ? 'Création du compte…' : 'Créer mon compte'}
      </Button>
    </form>
  )
}
