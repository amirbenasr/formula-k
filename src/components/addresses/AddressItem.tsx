'use client'

import React from 'react'
import type { Address } from '@/payload-types'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'

type Props = {
  address: Partial<Omit<Address, 'country'>> & { country?: string } // Allow address to be partial and entirely optional as this is entirely for display purposes
  /**
   * Completely override the default actions
   */
  actions?: React.ReactNode
  /**
   * Insert elements before the actions
   */
  beforeActions?: React.ReactNode
  /**
   * Insert elements after the actions
   */
  afterActions?: React.ReactNode
  /**
   * Hide all actions
   */
  hideActions?: boolean
}

export const AddressItem: React.FC<Props> = ({
  address,
  actions,
  hideActions = false,
  beforeActions,
  afterActions,
}) => {
  if (!address) {
    return null
  }

  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-sm text-muted">
        <p className="font-medium text-foreground">
          {address.title ? `${address.title} ` : ''}
          {address.firstName} {address.lastName}
        </p>
        {address.company ? <p>{address.company}</p> : null}
        {address.phone ? <p>{address.phone}</p> : null}
        <p>
          {address.addressLine1}
          {address.addressLine2 ? `, ${address.addressLine2}` : ''}
        </p>
        {cityLine ? <p>{cityLine}</p> : null}
        {address.country ? <p>{address.country}</p> : null}
      </div>

      {!hideActions && address.id ? (
        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
          {actions ? (
            actions
          ) : (
            <>
              {beforeActions}
              <CreateAddressModal
                addressID={address.id}
                buttonText="Modifier"
                initialData={address}
                modalTitle="Modifier l’adresse"
              />
              {afterActions}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
