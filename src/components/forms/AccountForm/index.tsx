'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/payload-types'
import { useAuth } from '@/providers/Auth'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormData = {
  email: string
  name: User['name']
  password: string
  passwordConfirm: string
}

export const AccountForm: React.FC = () => {
  const { setUser, user } = useAuth()
  const [changePassword, setChangePassword] = useState(false)

  const {
    formState: { errors, isLoading, isSubmitting, isDirty },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const router = useRouter()

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (user) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/${user.id}`, {
          // Make sure to include cookies with fetch
          body: JSON.stringify(data),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'PATCH',
        })

        if (response.ok) {
          const json = await response.json()
          setUser(json.doc)
          toast.success('Vos informations ont été mises à jour.')
          setChangePassword(false)
          reset({
            name: json.doc.name,
            email: json.doc.email,
            password: '',
            passwordConfirm: '',
          })
        } else {
          toast.error('La mise à jour de votre compte a échoué.')
        }
      }
    },
    [user, setUser, reset],
  )

  useEffect(() => {
    if (user === null) {
      router.push(
        `/login?warning=${encodeURIComponent('Connectez-vous pour accéder à votre compte.')}&redirect=${encodeURIComponent('/account')}`,
      )
    }

    // Once user is loaded, reset form to have default values
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        password: '',
        passwordConfirm: '',
      })
    }
  }, [user, router, reset, changePassword])

  return (
    <form className="flex max-w-xl flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <p className="text-sm text-muted">
        {changePassword ? (
          <>
            Choisissez un nouveau mot de passe, ou{' '}
            <button
              className="-my-1 py-1 font-medium text-primary-ink underline-offset-4 hover:underline"
              onClick={() => setChangePassword(false)}
              type="button"
            >
              revenir à vos informations
            </button>
            .
          </>
        ) : (
          <>
            Modifiez vos informations ci-dessous, ou{' '}
            <button
              className="-my-1 py-1 font-medium text-primary-ink underline-offset-4 hover:underline"
              onClick={() => setChangePassword(true)}
              type="button"
            >
              changer votre mot de passe
            </button>
            .
          </>
        )}
      </p>

      {changePassword ? (
        <div className="flex flex-col gap-5">
          <FormItem>
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              autoComplete="new-password"
              id="password"
              type="password"
              {...register('password', { required: 'Veuillez saisir un nouveau mot de passe.' })}
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
                required: 'Veuillez confirmer votre nouveau mot de passe.',
                validate: (value) =>
                  value === password.current || 'Les mots de passe ne correspondent pas.',
              })}
            />
            {errors.passwordConfirm ? <FormError message={errors.passwordConfirm.message} /> : null}
          </FormItem>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <FormItem>
            <Label htmlFor="name">Nom complet</Label>
            <Input
              autoComplete="name"
              id="name"
              type="text"
              {...register('name', { required: 'Veuillez indiquer votre nom.' })}
            />
            {errors.name ? <FormError message={errors.name.message} /> : null}
          </FormItem>

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
        </div>
      )}

      <Button
        className="w-full sm:w-auto"
        disabled={isLoading || isSubmitting || !isDirty}
        type="submit"
      >
        {isLoading || isSubmitting
          ? 'Enregistrement…'
          : changePassword
            ? 'Changer le mot de passe'
            : 'Enregistrer'}
      </Button>
    </form>
  )
}
