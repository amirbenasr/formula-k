import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const RewardTransactions: CollectionConfig = {
  slug: 'reward-transactions',
  labels: {
    singular: 'Reward Transaction',
    plural: 'Reward Transactions',
  },
  admin: {
    group: 'Rewards',
    defaultColumns: ['user', 'type', 'points', 'action', 'createdAt'],
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (!user) return false
      // Admins can read all, customers only their own
      if (user.roles?.includes('admin')) return true
      return {
        user: {
          equals: user.id,
        },
      }
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      hasMany: false,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Earned', value: 'earned' },
        { label: 'Redeemed', value: 'redeemed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Adjusted', value: 'adjusted' },
      ],
    },
    {
      name: 'points',
      type: 'number',
      required: true,
      label: 'Points',
      admin: {
        description: 'Positive for earned, negative for redeemed/expired',
      },
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Welcome Bonus', value: 'welcome' },
        { label: 'Profile Completed', value: 'profile_complete' },
        { label: 'Purchase', value: 'purchase' },
        { label: 'Review', value: 'review' },
        { label: 'Review with Photo', value: 'review_photo' },
        { label: 'Referral', value: 'referral' },
        { label: 'Birthday Bonus', value: 'birthday' },
        { label: 'Social Follow', value: 'social_follow' },
        { label: 'Daily Check-in', value: 'checkin' },
        { label: 'Challenge Completed', value: 'challenge' },
        { label: 'Reward Redemption', value: 'redemption' },
        { label: 'Points Expiry', value: 'expiry' },
        { label: 'Admin Adjustment', value: 'admin_adjustment' },
      ],
    },
    {
      name: 'description',
      type: 'text',
      label: 'Description',
      admin: {
        description: 'Human-readable description of the transaction',
      },
    },
    {
      name: 'relatedOrder',
      type: 'relationship',
      relationTo: 'orders',
      hasMany: false,
      admin: {
        description: 'Related order if this is a purchase transaction',
        condition: (data) => data?.action === 'purchase',
      },
    },
    {
      name: 'relatedReward',
      type: 'relationship',
      relationTo: 'rewards-catalog',
      hasMany: false,
      admin: {
        description: 'Related reward if this is a redemption',
        condition: (data) => data?.action === 'redemption',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional data (order ID, referral code, etc.)',
      },
    },
  ],
  timestamps: true,
}
