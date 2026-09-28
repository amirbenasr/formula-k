'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { useRouter } from 'next/navigation'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  orderID: string
}

type Props = {
  initialEmail?: string
}

export const FindOrderForm: React.FC<Props> = ({ initialEmail }) => {
  const router = useRouter()
  const { user } = useAuth()

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>({
    defaultValues: {
      email: initialEmail || user?.email,
    },
  })

  const onSubmit = useCallback(
    async (data: FormData) => {
      router.push(`/orders/${data.orderID}?email=${data.email}`)
    },
    [router],
  )

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <FormItem>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          autoComplete="email"
          id="email"
          placeholder="L’adresse utilisée lors de la commande"
          type="email"
          {...register('email', { required: 'Veuillez indiquer votre adresse e-mail.' })}
        />
        {errors.email ? <FormError message={errors.email.message} /> : null}
      </FormItem>

      <FormItem>
        <Label htmlFor="orderID">Numéro de commande</Label>
        <Input
          id="orderID"
          placeholder="Ex. 1042"
          type="text"
          {...register('orderID', {
            required:
              'Le numéro de commande est obligatoire. Il figure dans votre e-mail de confirmation.',
          })}
        />
        {errors.orderID ? <FormError message={errors.orderID.message} /> : null}
      </FormItem>

      <Button className="w-full" size="lg" type="submit">
        Retrouver ma commande
      </Button>
    </form>
  )
}
