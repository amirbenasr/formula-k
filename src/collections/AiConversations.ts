import { adminOnly } from '@/access/adminOnly'
import { checkRole } from '@/access/utilities'
import type { Access, CollectionConfig } from 'payload'

/**
 * Conversations are personal, so reads and writes are scoped to the owner.
 * Admins can read every row (the admin panel is where you go to audit what the
 * assistant was asked), but only the owner can rename or delete their own.
 */
const ownerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user)) return true

  return { owner: { equals: user.id } }
}

const ownerOnly: Access = ({ req: { user } }) => {
  if (!user) return false

  return { owner: { equals: user.id } }
}

/**
 * One row per assistant conversation — the durable, GPT-style history behind
 * /admin/ai.
 *
 * The transcript is stored as a single `messages` JSON column in the exact
 * shape the AI SDK's `useChat` works with. That keeps "reopen a conversation"
 * a single read and means tool calls, staged proposals and their outputs survive
 * a reload without a second schema to keep in sync. The cost is that a turn
 * rewrites the column; at the scale of a store's admin chat that is a fraction
 * of a millisecond, and far simpler than reconstructing a part graph from rows.
 *
 * `key` is the client-generated id (a UUID) that `useChat` and the assistant's
 * tools already use. It is deliberately separate from Payload's numeric `id`
 * so AiActionLog.conversationId can stay a text column and old audit rows keep
 * pointing at the right conversation.
 */
export const AiConversations: CollectionConfig = {
  slug: 'ai-conversations',
  access: {
    create: adminOnly,
    delete: ownerOnly,
    // Renaming is done from the chat sidebar, where the row is always the
    // caller's own; sharing the same constraint here keeps the REST surface
    // from becoming a way to edit someone else's history.
    update: ownerOnly,
    read: ownerOrAdmin,
  },
  admin: {
    defaultColumns: ['title', 'owner', 'messageCount', 'lastMessageAt', 'updatedAt'],
    description:
      'Chat history for the admin AI assistant. Each row is one conversation; the transcript is in `messages`.',
    group: 'AI',
    // The chat sidebar is the interface. This table would otherwise put raw
    // UIMessage JSON one click away from an accidental edit, and clutter the
    // dashboard for someone who just wants to ask a question.
    hidden: true,
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      admin: {
        description: 'Client-generated conversation id. Stable across reloads.',
        position: 'sidebar',
        readOnly: true,
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Derived from the first message; can be renamed from the chat sidebar.' },
      maxLength: 120,
      required: true,
    },
    {
      name: 'owner',
      type: 'relationship',
      admin: { position: 'sidebar' },
      index: true,
      relationTo: 'users',
      required: true,
    },
    {
      name: 'preview',
      type: 'text',
      admin: { description: 'Last thing said, shown in the conversation list.' },
      maxLength: 200,
    },
    {
      name: 'messageCount',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true },
      defaultValue: 0,
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar' },
      index: true,
    },
    {
      name: 'messages',
      type: 'json',
      admin: {
        description:
          'AI SDK UIMessage[] transcript. Written by /api/admin-ai/chat; editing it by hand will not update the chat.',
      },
    },
  ],
  timestamps: true,
}
