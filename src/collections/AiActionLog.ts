import { adminOnly } from '@/access/adminOnly'
import type { CollectionConfig } from 'payload'

/**
 * Every change the admin AI assistant proposes is staged here first.
 *
 * The assistant itself has NO write access to products or orders. When the
 * model wants to change something it can only create a `pending` row in this
 * collection describing the change. A human then clicks Apply in the chat,
 * which calls `/api/admin-ai/apply` and performs the real write.
 *
 * That keeps "dry-run + confirm" a property of the server rather than a request
 * we politely make of the model in a system prompt.
 */
export const AiActionLog: CollectionConfig = {
  slug: 'ai-action-logs',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['summary', 'status', 'toolName', 'requestedBy', 'createdAt'],
    description:
      'Audit trail of every change proposed by the admin AI assistant, and whether it was applied.',
    group: 'AI',
    useAsTitle: 'summary',
  },
  fields: [
    {
      name: 'summary',
      type: 'text',
      admin: { description: 'One-line description of the proposed change.' },
      required: true,
    },
    {
      name: 'toolName',
      type: 'text',
      admin: { description: 'Which assistant tool produced this proposal.' },
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      admin: { position: 'sidebar' },
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Applied', value: 'applied' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      required: true,
    },
    {
      name: 'conversationId',
      type: 'text',
      admin: { position: 'sidebar' },
      index: true,
    },
    {
      name: 'requestedBy',
      type: 'relationship',
      admin: { position: 'sidebar' },
      relationTo: 'users',
      required: true,
    },
    {
      name: 'changes',
      type: 'json',
      admin: {
        description: 'Planned row-level changes, captured before anything is written.',
      },
    },
    {
      name: 'result',
      type: 'json',
      admin: { description: 'What was actually written once the change was applied.' },
    },
    {
      name: 'error',
      type: 'textarea',
      admin: { description: 'Failure detail when status is "failed".' },
    },
    {
      name: 'appliedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar' },
    },
  ],
  timestamps: true,
}
