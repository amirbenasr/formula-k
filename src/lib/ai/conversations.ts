import type { UIMessage } from 'ai'
import { APIError, type Payload, type Where } from 'payload'

import type { User } from '@/payload-types'

import {
  DEFAULT_CONVERSATION_TITLE,
  deriveConversationPreview,
  deriveConversationTitle,
  isConversationKey,
  relationshipId,
  stripAttachmentNotes,
} from './conversation-text'
import type { LooseDoc } from './types'

export {
  DEFAULT_CONVERSATION_TITLE,
  deriveConversationPreview,
  deriveConversationTitle,
  isConversationKey,
  relationshipId,
  stripAttachmentNotes,
}

/**
 * Conversation persistence for /admin/ai.
 *
 * The shape kept here is deliberately the same `UIMessage[]` the client already
 * streams, so hydrating a past conversation is `useChat({ messages })` with no
 * conversion step. The text rules (title, preview, key format) live in
 * `conversation-text.ts` so the unit tests exercise them without a database.
 */

type ConversationDoc = LooseDoc & {
  id: number | string
  key: string
  messages?: unknown
  owner?: unknown
  preview?: string
  title: string
}

export function assertConversationKey(value: unknown): string {
  if (!isConversationKey(value)) {
    throw new APIError('Conversation ids must be UUID-style strings.', 400)
  }

  return value
}

export type ConversationSummary = {
  key: string
  lastMessageAt: string | null
  messageCount: number
  preview: string
  title: string
  updatedAt: string | null
}

export type ConversationAction = {
  actionId: string
  appliedAt: string | null
  error: string | null
  /** The staged change's one-line description, e.g. "Set stock for Anua Toner 250ml to 12". */
  summary: string | null
  status: 'applied' | 'cancelled' | 'failed' | 'pending'
}

function toSummary(doc: ConversationDoc): ConversationSummary {
  return {
    key: doc.key,
    lastMessageAt: doc.lastMessageAt ?? null,
    messageCount: typeof doc.messageCount === 'number' ? doc.messageCount : 0,
    preview: doc.preview ?? '',
    title: doc.title || DEFAULT_CONVERSATION_TITLE,
    updatedAt: doc.updatedAt ?? null,
  }
}

async function findByKey({
  key,
  payload,
  user,
}: {
  key: string
  payload: Payload
  user: User
}): Promise<ConversationDoc | null> {
  const { docs } = await payload.find({
    collection: 'ai-conversations',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    user,
    where: { key: { equals: key } },
  })

  return (docs[0] as ConversationDoc | undefined) ?? null
}

/**
 * Loads the caller's conversation, refusing one that belongs to somebody else.
 *
 * Ownership is checked in code as well as in the collection's access rules
 * because admins can read every row: "you may read it" is not the same as "it is
 * your chat", and the chat endpoint must never append to another admin's history.
 */
export async function getOwnedConversation({
  key,
  payload,
  user,
}: {
  key: string
  payload: Payload
  user: User
}): Promise<ConversationDoc | null> {
  const doc = await findByKey({ key, payload, user })

  if (!doc) return null
  if (relationshipId(doc.owner) !== user.id) {
    throw new APIError('This conversation belongs to another user.', 403)
  }

  return doc
}

/**
 * Writes the incoming transcript and, when the row is new, derives its title.
 *
 * Called once as soon as the request arrives (so the user's message survives a
 * provider failure) and again from the stream's `onEnd` with the assistant's
 * reply included.
 */
export async function persistConversation({
  key,
  messages,
  payload,
  user,
}: {
  key: string
  messages: UIMessage[]
  payload: Payload
  user: User
}): Promise<ConversationSummary> {
  const existing = await getOwnedConversation({ key, payload, user })
  const title = deriveConversationTitle(messages)
  const now = new Date().toISOString()

  const data = {
    lastMessageAt: now,
    messageCount: messages.length,
    messages,
    preview: deriveConversationPreview(messages),
  }

  if (existing) {
    // A follow-up turn may have persisted while the previous stream's `onEnd`
    // was still in flight. Never let the older, shorter transcript overwrite the
    // newer one; the model's next request carries the full history anyway.
    if (
      typeof existing.messageCount === 'number' &&
      existing.messageCount > messages.length
    ) {
      return toSummary(existing)
    }

    // Renames are the administrator's, not ours: only replace the placeholder.
    const retitle =
      (!existing.title || existing.title === DEFAULT_CONVERSATION_TITLE) &&
      title !== DEFAULT_CONVERSATION_TITLE
        ? { title }
        : {}

    const updated = await payload.update({
      id: existing.id,
      collection: 'ai-conversations',
      data: { ...data, ...retitle },
      overrideAccess: false,
      user,
    })

    return toSummary(updated as ConversationDoc)
  }

  try {
    const created = await payload.create({
      collection: 'ai-conversations',
      data: {
        ...data,
        key,
        owner: user.id,
        title: title || DEFAULT_CONVERSATION_TITLE,
      },
      overrideAccess: false,
      user,
    })

    return toSummary(created as ConversationDoc)
  } catch (error) {
    // Two sends racing on a brand-new chat both see "not found" and both try to
    // create; the unique index on `key` rejects the loser. Recover by updating
    // the row the winner created rather than surfacing a 500 to the admin.
    const raced = await getOwnedConversation({ key, payload, user })

    if (!raced) throw error

    const updated = await payload.update({
      id: raced.id,
      collection: 'ai-conversations',
      data: { ...data, title: raced.title || title },
      overrideAccess: false,
      user,
    })

    return toSummary(updated as ConversationDoc)
  }
}

export async function listConversations({
  limit = 100,
  payload,
  search,
  user,
}: {
  limit?: number
  payload: Payload
  search?: string
  user: User
}): Promise<ConversationSummary[]> {
  const where: Where = { owner: { equals: user.id } }

  if (search) {
    where.or = [{ title: { contains: search } }, { preview: { contains: search } }]
  }

  const { docs } = await payload.find({
    collection: 'ai-conversations',
    depth: 0,
    limit,
    overrideAccess: false,
    select: {
      key: true,
      lastMessageAt: true,
      messageCount: true,
      preview: true,
      title: true,
      updatedAt: true,
    },
    sort: '-lastMessageAt',
    user,
    where,
  })

  return docs.map((doc) => toSummary(doc as unknown as ConversationDoc))
}

export async function loadConversation({
  key,
  payload,
  user,
}: {
  key: string
  payload: Payload
  user: User
}): Promise<{ actions: ConversationAction[]; messages: UIMessage[]; summary: ConversationSummary }> {
  const doc = await getOwnedConversation({ key, payload, user })

  if (!doc) {
    throw new APIError('Conversation not found.', 404)
  }

  return {
    actions: await getConversationActions({ key, payload, user }),
    messages: Array.isArray(doc.messages) ? (doc.messages as UIMessage[]) : [],
    summary: toSummary(doc),
  }
}

export async function renameConversation({
  key,
  payload,
  title,
  user,
}: {
  key: string
  payload: Payload
  title: unknown
  user: User
}): Promise<ConversationSummary> {
  const next = typeof title === 'string' ? title.trim() : ''

  if (!next) throw new APIError('`title` is required.', 400)
  if (next.length > 120) throw new APIError('`title` must be 120 characters or fewer.', 400)

  const doc = await getOwnedConversation({ key, payload, user })

  if (!doc) throw new APIError('Conversation not found.', 404)

  const updated = await payload.update({
    id: doc.id,
    collection: 'ai-conversations',
    data: { title: next },
    overrideAccess: false,
    user,
  })

  return toSummary(updated as ConversationDoc)
}

export async function deleteConversation({
  key,
  payload,
  user,
}: {
  key: string
  payload: Payload
  user: User
}): Promise<void> {
  const doc = await getOwnedConversation({ key, payload, user })

  if (!doc) throw new APIError('Conversation not found.', 404)

  await payload.delete({
    id: doc.id,
    collection: 'ai-conversations',
    overrideAccess: false,
    user,
  })
}

/**
 * The proposals raised during this conversation, so a reopened chat can show
 * "Applied" instead of offering the Apply button again (which would 409 on
 * replay). Action rows are never deleted with the conversation: they are the
 * audit trail.
 */
export async function getConversationActions({
  key,
  payload,
  user,
}: {
  key: string
  payload: Payload
  user: User
}): Promise<ConversationAction[]> {
  const { docs } = await payload.find({
    collection: 'ai-action-logs',
    depth: 0,
    limit: 200,
    overrideAccess: false,
    select: {
      appliedAt: true,
      error: true,
      status: true,
      summary: true,
    },
    sort: 'createdAt',
    user,
    where: { conversationId: { equals: key } },
  })

  return docs.map((doc) => {
    const row = doc as LooseDoc

    return {
      actionId: String(row.id),
      appliedAt: typeof row.appliedAt === 'string' ? row.appliedAt : null,
      error: typeof row.error === 'string' ? row.error : null,
      status: (row.status as ConversationAction['status']) ?? 'pending',
      summary: typeof row.summary === 'string' ? row.summary : null,
    }
  })
}
