'use client'

import { AuthShell } from '@/components/auth/AuthShell'
import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  password: string
  passwordConfirm: string
}

export const ResetPasswordForm: React.FC = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
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
        setError('Lien de réinitialisation manquant. Demandez-en un nouveau.')
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
      } catch {
        setError(
          'La réinitialisation a échoué. Le lien a peut-être expiré : demandez-en un nouveau.',
        )
      }
    },
    [token, resetPassword],
  )

  if (!token) {
    return (
      <AuthShell
        description="Ce lien de réinitialisation est invalide ou a expiré."
        icon={ShieldCheck}
        title="Lien invalide"
      >
        <Button asChild className="w-full" size="lg">
          <Link href="/forgot-password">Demander un nouveau lien</Link>
        </Button>
      </AuthShell>
    )
  }

  if (success) {
    return (
      <AuthShell
        description="Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter."
        icon={ShieldCheck}
        title="Mot de passe modifié"
      >
        <Button asChild className="w-full" size="lg">
          <Link href="/login">Se connecter</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description="Choisissez un nouveau mot de passe pour votre compte."
      icon={ShieldCheck}
      title="Nouveau mot de passe"
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        <Message error={error} />

        <FormItem>
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            autoComplete="new-password"
            id="password"
            type="password"
            {...register('password', {
              required: 'Veuillez saisir un nouveau mot de passe.',
              minLength: {
                value: 8,
                message: 'Le mot de passe doit contenir au moins 8 caractères.',
              },
            })}
          />
          {errors.password ? <FormError message={errors.password.message} /> : null}
        </FormItem>

        <FormItem>
          <Label htmlFor="passwordConfirm">Confirmer le nouveau mot de passe</Label>
          <Input
            autoComplete="new-password"
            id="passwordConfirm"
            type="password"
            {...register('passwordConfirm', {
              required: 'Veuillez confirmer votre mot de passe.',
              validate: (value) => value === password || 'Les mots de passe ne correspondent pas.',
            })}
          />
          {errors.passwordConfirm ? <FormError message={errors.passwordConfirm.message} /> : null}
        </FormItem>

        <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </Button>
      </form>
    </AuthShell>
  )
}
