import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const RewardsCatalog: CollectionConfig = {
  slug: 'rewards-catalog',
  labels: {
    singular: 'Reward',
    plural: 'Rewards Catalog',
  },
  admin: {
    group: 'Rewards',
    useAsTitle: 'name',
    defaultColumns: ['name', 'pointsCost', 'type', 'isActive'],
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Reward Name',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
    {
      name: 'pointsCost',
      type: 'number',
      required: true,
      min: 0,
      label: 'Points Required',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Discount Amount', value: 'discount_amount' },
        { label: 'Discount Percentage', value: 'discount_percent' },
        { label: 'Free Product', value: 'free_product' },
        { label: 'Free Shipping', value: 'free_shipping' },
        { label: 'Free Sample', value: 'free_sample' },
      ],
    },
    {
      name: 'discountValue',
      type: 'number',
      label: 'Discount Value',
      admin: {
        description: 'Amount in TND for discount_amount, percentage for discount_percent',
        condition: (data) =>
          data?.type === 'discount_amount' || data?.type === 'discount_percent',
      },
    },
    {
      name: 'freeProduct',
      type: 'relationship',
      relationTo: 'products',
      hasMany: false,
      admin: {
        description: 'Product to give for free',
        condition: (data) => data?.type === 'free_product',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Reward Image',
    },
    {
      name: 'minimumTier',
      type: 'relationship',
      relationTo: 'reward-tiers',
      hasMany: false,
      label: 'Minimum Tier Required',
      admin: {
        description: 'Leave empty if available to all tiers',
      },
    },
    {
      name: 'limitPerUser',
      type: 'number',
      label: 'Limit Per User',
      admin: {
        description: 'Maximum times a user can redeem this reward (0 = unlimited)',
      },
      defaultValue: 0,
    },
    {
      name: 'totalAvailable',
      type: 'number',
      label: 'Total Available',
      admin: {
        description: 'Total inventory of this reward (0 = unlimited)',
      },
      defaultValue: 0,
    },
    {
      name: 'totalRedeemed',
      type: 'number',
      label: 'Total Redeemed',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'Active',
      defaultValue: true,
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      label: 'Featured Reward',
      defaultValue: false,
      admin: {
        description: 'Show prominently on the rewards page',
      },
    },
    {
      name: 'validFrom',
      type: 'date',
      label: 'Valid From',
    },
    {
      name: 'validUntil',
      type: 'date',
      label: 'Valid Until',
    },
    {
      name: 'order',
      type: 'number',
      label: 'Display Order',
      defaultValue: 0,
    },
  ],
}
