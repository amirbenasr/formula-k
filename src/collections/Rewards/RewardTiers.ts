import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const RewardTiers: CollectionConfig = {
  slug: 'reward-tiers',
  labels: {
    singular: 'Reward Tier',
    plural: 'Reward Tiers',
  },
  admin: {
    group: 'Rewards',
    useAsTitle: 'name',
    defaultColumns: ['name', 'minPoints', 'pointsMultiplier'],
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
      label: 'Tier Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly identifier (e.g., starter, glowing, radiant, glass-skin)',
      },
    },
    {
      name: 'minPoints',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: 'Minimum Points Required',
      admin: {
        description: 'Points needed to reach this tier',
      },
    },
    {
      name: 'pointsMultiplier',
      type: 'number',
      required: true,
      defaultValue: 1,
      label: 'Points Multiplier',
      admin: {
        description: 'Multiplier for earning points (e.g., 1.5 = 50% bonus)',
      },
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Icon/Emoji',
      admin: {
        description: 'Emoji or icon identifier for this tier',
      },
    },
    {
      name: 'color',
      type: 'text',
      label: 'Tier Color',
      admin: {
        description: 'Hex color for the tier badge',
      },
    },
    {
      name: 'benefits',
      type: 'array',
      label: 'Tier Benefits',
      fields: [
        {
          name: 'benefit',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: 'Display Order',
      admin: {
        description: 'Order in which tiers are displayed (lowest first)',
      },
    },
  ],
}
