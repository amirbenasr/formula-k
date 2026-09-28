'use client'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { defaultCountries as supportedCountries } from '@payloadcms/plugin-ecommerce/client/react'
import { Address, Config } from '@/payload-types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { titles } from './constants'
import { Button } from '@/components/ui/button'
import { deepMergeSimple } from 'payload/shared'
import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'

type AddressFormValues = {
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
}

type Props = {
  addressID?: Config['db']['defaultIDType']
  initialData?: Omit<Address, 'country' | 'id' | 'updatedAt' | 'createdAt'> & { country?: string }
  callback?: (data: Partial<Address>) => void
  /**
   * If true, the form will not submit to the API.
   */
  skipSubmission?: boolean
}

export const AddressForm: React.FC<Props> = ({
  addressID,
  initialData,
  callback,
  skipSubmission,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<AddressFormValues>({
    defaultValues: initialData,
  })

  const { createAddress, updateAddress } = useAddresses()

  const onSubmit = useCallback(
    async (data: AddressFormValues) => {
      const newData = deepMergeSimple(initialData || {}, data)

      if (!skipSubmission) {
        if (addressID) {
          await updateAddress(addressID, newData)
        } else {
          await createAddress(newData)
        }
      }

      if (callback) {
        callback(newData)
      }
    },
    [initialData, skipSubmission, callback, addressID, updateAddress, createAddress],
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-6">
        <FormItem className="sm:col-span-2">
          <Label htmlFor="title">Civilité</Label>
          <Select
            {...register('title')}
            defaultValue={initialData?.title || ''}
            onValueChange={(value) => {
              setValue('title', value, { shouldValidate: true })
            }}
          >
            <SelectTrigger className="w-full" id="title">
              <SelectValue placeholder="Civilité" />
            </SelectTrigger>
            <SelectContent>
              {titles.map((title) => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.title ? <FormError message={errors.title.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-2">
          <Label htmlFor="firstName">Prénom*</Label>
          <Input
            autoComplete="given-name"
            id="firstName"
            {...register('firstName', { required: 'Le prénom est obligatoire.' })}
          />
          {errors.firstName ? <FormError message={errors.firstName.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-2">
          <Label htmlFor="lastName">Nom*</Label>
          <Input
            autoComplete="family-name"
            id="lastName"
            {...register('lastName', { required: 'Le nom est obligatoire.' })}
          />
          {errors.lastName ? <FormError message={errors.lastName.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-3">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            autoComplete="tel"
            id="phone"
            inputMode="tel"
            placeholder="+216 __ ___ ___"
            type="tel"
            {...register('phone')}
          />
          {errors.phone ? <FormError message={errors.phone.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-3">
          <Label htmlFor="company">Société (optionnel)</Label>
          <Input autoComplete="organization" id="company" {...register('company')} />
          {errors.company ? <FormError message={errors.company.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-6">
          <Label htmlFor="addressLine1">Adresse*</Label>
          <Input
            autoComplete="address-line1"
            id="addressLine1"
            placeholder="Rue, numéro, immeuble…"
            {...register('addressLine1', { required: "L'adresse est obligatoire." })}
          />
          {errors.addressLine1 ? <FormError message={errors.addressLine1.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-6">
          <Label htmlFor="addressLine2">Complément d’adresse (optionnel)</Label>
          <Input
            autoComplete="address-line2"
            id="addressLine2"
            placeholder="Appartement, étage, résidence…"
            {...register('addressLine2')}
          />
          {errors.addressLine2 ? <FormError message={errors.addressLine2.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-2">
          <Label htmlFor="city">Ville*</Label>
          <Input
            autoComplete="address-level2"
            id="city"
            {...register('city', { required: 'La ville est obligatoire.' })}
          />
          {errors.city ? <FormError message={errors.city.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-2">
          <Label htmlFor="state">Gouvernorat</Label>
          <Input autoComplete="address-level1" id="state" {...register('state')} />
          {errors.state ? <FormError message={errors.state.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-2">
          <Label htmlFor="postalCode">Code postal*</Label>
          <Input
            autoComplete="postal-code"
            id="postalCode"
            inputMode="numeric"
            {...register('postalCode', { required: 'Le code postal est obligatoire.' })}
          />
          {errors.postalCode ? <FormError message={errors.postalCode.message} /> : null}
        </FormItem>

        <FormItem className="sm:col-span-6">
          <Label htmlFor="country">Pays*</Label>
          <Select
            {...register('country', {
              required: 'Le pays est obligatoire.',
            })}
            defaultValue={initialData?.country || ''}
            onValueChange={(value) => {
              setValue('country', value, { shouldValidate: true })
            }}
            required
          >
            <SelectTrigger className="w-full" id="country">
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              {supportedCountries.map((country) => {
                const value = typeof country === 'string' ? country : country.value
                const label =
                  typeof country === 'string'
                    ? country
                    : typeof country.label === 'string'
                      ? country.label
                      : value

                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {errors.country ? <FormError message={errors.country.message} /> : null}
        </FormItem>
      </div>

      <Button className="w-full sm:w-auto" type="submit">
        Enregistrer l’adresse
      </Button>
    </form>
  )
}
