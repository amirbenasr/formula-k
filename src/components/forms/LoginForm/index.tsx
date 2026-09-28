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
import React, { useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
}

export const LoginForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const redirect = useRef(searchParams.get('redirect'))
  const { login } = useAuth()
  const router = useRouter()
  const [error, setError] = React.useState<null | string>(null)

  const {
    formState: { errors, isLoading },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        await login(data)
        if (redirect?.current) router.push(redirect.current)
        else router.push('/account')
      } catch (_) {
        setError('E-mail ou mot de passe incorrect. Merci de réessayer.')
      }
    },
    [login, router],
  )

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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Link
            className="inline-flex min-h-6 items-center text-xs font-medium text-primary-ink underline-offset-4 hover:underline"
            href={`/forgot-password${allParams}`}
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Input
          autoComplete="current-password"
          id="password"
          type="password"
          {...register('password', { required: 'Veuillez indiquer votre mot de passe.' })}
        />
        {errors.password ? <FormError message={errors.password.message} /> : null}
      </FormItem>

      <Button className="w-full" disabled={isLoading} size="lg" type="submit">
        {isLoading ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  )
}
