import type { CollectionConfig, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { patchCollectionMoneyFields, patchMoneyFields } from '../tndAdminPrices'

/** The shape `amountField` gives every money field the ecommerce plugin creates. */
const pluginMoneyField = (name: string, label: string): Field =>
  ({
    name,
    type: 'number',
    label: () => label,
    admin: {
      components: {
        Cell: { clientProps: {}, path: '@payloadcms/plugin-ecommerce/client#PriceCell' },
        Field: { clientProps: {}, path: '@payloadcms/plugin-ecommerce/rsc#PriceInput' },
      },
    },
  }) as unknown as Field

const priceGroup = (): Field =>
  ({
    type: 'group',
    admin: { description: 'Prices for this product in different currencies.' },
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'priceInUSDEnabled', type: 'checkbox', label: () => 'Enable USD price' },
          pluginMoneyField('priceInUSD', 'Price (USD)'),
        ],
      },
    ],
  }) as unknown as Field

/** The read-only select `currencyField` builds next to an order/cart amount. */
const currencySelect = (): Field =>
  ({
    name: 'currency',
    type: 'select',
    admin: { readOnly: true },
    defaultValue: 'USD',
    options: [{ label: 'US Dollar (USD)', value: 'USD' }],
  }) as unknown as Field

const adminComponents = (field: Field) =>
  (field as unknown as { admin?: { components?: Record<string, unknown> } }).admin?.components

const findField = (fields: Field[], name: string): Field | undefined => {
  for (const field of fields) {
    const loose = field as unknown as {
      name?: string
      fields?: Field[]
      tabs?: { fields?: Field[] }[]
    }

    if (loose.name === name) return field

    const nested = [
      ...(loose.fields ?? []),
      ...(loose.tabs ?? []).flatMap((tab) => tab.fields ?? []),
    ]

    const found = findField(nested, name)

    if (found) return found
  }

  return undefined
}

describe('tndAdminPrices', () => {
  it('points product price fields at the TND input and cell', () => {
    const [group] = patchMoneyFields([priceGroup()])
    const price = findField([group], 'priceInUSD')!

    expect(adminComponents(price)?.Field).toBe('@/components/admin/TNDPriceInput#TNDPriceInput')
    expect(adminComponents(price)?.Cell).toBe('@/components/admin/TNDPriceCell#TNDPriceCell')
  })

  it('labels the product price in dinars and drops the USD wording', () => {
    const [group] = patchMoneyFields([priceGroup()])
    const price = findField([group], 'priceInUSD')! as unknown as {
      admin: { description: string }
      label: string
    }
    const toggle = findField([group], 'priceInUSDEnabled')! as unknown as { label: string }

    expect(price.label).toBe('Price (TND)')
    expect(price.admin.description).toContain('Tunisian dinars')
    expect(toggle.label).toBe('Enable TND price')
  })

  it('replaces the "different currencies" note on the wrapping group', () => {
    const [group] = patchMoneyFields([priceGroup()]) as unknown as {
      admin: { description: string }
    }[]

    expect(group.admin.description).toContain('Tunisian dinars')
  })

  it('keeps the label of amount fields that are not named after a currency', () => {
    const amount = pluginMoneyField('amount', 'Amount')
    const [patched] = patchMoneyFields([amount]) as unknown as {
      admin: { description?: string }
      label: unknown
    }[]
    const original = amount as unknown as { label: unknown }

    // The plugin's own translation function, and none of the dinar copy.
    expect(patched.label).toBe(original.label)
    expect(patched.admin.description).toBeUndefined()
  })

  it('formats order amounts as dinars', () => {
    const [amount] = patchMoneyFields([pluginMoneyField('amount', 'Amount')])

    expect(adminComponents(amount)?.Field).toBe('@/components/admin/TNDPriceInput#TNDPriceInput')
    expect(adminComponents(amount)?.Cell).toBe('@/components/admin/TNDPriceCell#TNDPriceCell')
  })

  it('relabels the currency select without touching the value the plugin looks up', () => {
    const [currency] = patchMoneyFields([currencySelect()]) as unknown as {
      defaultValue: string
      options: { label: string; value: string }[]
    }[]

    expect(currency.options).toEqual([{ label: 'Tunisian Dinar (DT)', value: 'USD' }])
    expect(currency.defaultValue).toBe('USD')
  })

  it('leaves unrelated fields and components untouched', () => {
    const other = {
      name: 'inventory',
      type: 'number',
      admin: { components: { Field: '@/components/admin/StockInput#StockInput' } },
    } as unknown as Field

    const [patched] = patchMoneyFields([other])

    expect(patched).toEqual(other)
  })

  it('leaves unrelated selects untouched', () => {
    const status = {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Processing', value: 'processing' },
        { label: 'Completed', value: 'completed' },
      ],
    } as unknown as Field

    const [patched] = patchMoneyFields([status])

    expect(patched).toEqual(status)
  })

  it('walks every collection of a config', () => {
    const collection = {
      slug: 'products',
      fields: [priceGroup()],
    } as unknown as CollectionConfig

    const patched = patchCollectionMoneyFields(collection)

    expect(adminComponents(findField(patched.fields, 'priceInUSD')!)?.Field).toBe(
      '@/components/admin/TNDPriceInput#TNDPriceInput',
    )
  })
})
