'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
}

export const ForgotPasswordForm: React.FC = () => {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(async (data: FormData) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/forgot-password`,
      {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    )

    if (response.ok) {
      setSuccess(true)
      setError('')
    } else {
      setError(
        'L’envoi de l’e-mail de réinitialisation a échoué. Merci de réessayer dans un instant.',
      )
    }
  }, [])

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
          <CheckCircle2 className="h-5 w-5 text-accent-800" />
        </span>
        <p className="text-sm text-muted">
          Demande envoyée. Consultez votre boîte e-mail : vous y trouverez un lien pour choisir un
          nouveau mot de passe.
        </p>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href="/login">Retour à la connexion</Link>
        </Button>
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

      <Button className="w-full" size="lg" type="submit">
        Envoyer le lien de réinitialisation
      </Button>
    </form>
  )
}
