import { adminOnly } from '@/access/adminOnly'
import { roundAmount } from '@/components/admin/tndPrice'
import type { CollectionConfig } from 'payload'

/**
 * What competitors charge for a product we sell.
 *
 * One row per product × competitor domain, refreshed in place rather than
 * appended, so the list stays readable and a shop that drops its price can be
 * spotted from `previousPrice`. Rows are also editable by hand: a Google search
 * never finds everything, and the admin needs somewhere to record the price they
 * found themselves.
 *
 * Kept as its own collection rather than an array on the product so it can be
 * queried across the catalogue — "where are we more expensive than the market?"
 * — without loading every product document.
 */
export const CompetitorPrices: CollectionConfig = {
  slug: 'competitor-prices',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['label', 'product', 'competitorPrice', 'source', 'fetchedAt'],
    description:
      'Prices competitors charge for the same product. Filled in from Google search on the product edit view, or by hand.',
    group: 'Content',
    useAsTitle: 'label',
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: {
        description: 'Generated from the competitor and the price.',
        readOnly: true,
      },
      index: true,
    },
    {
      name: 'product',
      type: 'relationship',
      admin: {
        description: 'The Formula K product this price competes with.',
      },
      index: true,
      relationTo: 'products',
      required: true,
    },
    {
      name: 'source',
      type: 'text',
      admin: {
        description: 'Competitor domain, e.g. `mytek.tn`. One row per competitor per product.',
      },
      index: true,
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: "The competitor's own listing title, as Google reported it.",
      },
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        description: 'Link to the competitor listing.',
      },
    },
    {
      name: 'competitorPrice',
      type: 'number',
      admin: {
        components: {
          Cell: '@/components/admin/TNDPriceCell#TNDPriceCell',
        },
        description: 'In Tunisian dinars, the same way our own prices are stored.',
      },
      min: 0,
      required: true,
    },
    {
      name: 'rawPriceText',
      type: 'text',
      admin: {
        description: 'The price exactly as it appeared in the search result, for auditing.',
        readOnly: true,
      },
    },
    {
      name: 'previousPrice',
      type: 'number',
      admin: {
        description: 'What this competitor charged the time before. Set automatically.',
        readOnly: true,
      },
      min: 0,
    },
    {
      name: 'priceChangedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When the competitor last changed their price.',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'matchConfidence',
      type: 'select',
      admin: {
        description:
          'How sure the search is that this listing is the same product. "Uncertain" rows are worth checking before repricing anything.',
        position: 'sidebar',
      },
      defaultValue: 'likely',
      options: [
        { label: 'Exact match', value: 'exact' },
        { label: 'Likely match', value: 'likely' },
        { label: 'Uncertain', value: 'uncertain' },
      ],
    },
    {
      name: 'ignored',
      type: 'checkbox',
      admin: {
        description: 'Tick to hide a row that matched the wrong product, without deleting it.',
        position: 'sidebar',
      },
      defaultValue: false,
      index: true,
    },
    {
      name: 'fetchedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When this price was last seen.',
        position: 'sidebar',
      },
    },
    {
      name: 'fetchMethod',
      type: 'select',
      admin: {
        position: 'sidebar',
      },
      defaultValue: 'serpapi',
      options: [
        { label: 'Google search', value: 'serpapi' },
        { label: 'Entered by hand', value: 'manual' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Anything worth remembering about this price.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        if (!data.fetchedAt) data.fetchedAt = new Date().toISOString()

        // Composed here rather than in the endpoint so hand-entered rows get a
        // usable title too — this is what the admin list view shows.
        data.label = [
          data.source,
          typeof data.competitorPrice === 'number'
            ? `${roundAmount(data.competitorPrice)} DT`
            : null,
        ]
          .filter(Boolean)
          .join(' — ')

        return data
      },
    ],
  },
  timestamps: true,
}
