import type { UIMessage } from 'ai'

/**
 * Pure text rules for conversations.
 *
 * Kept free of Payload imports so they can be unit-tested without a database
 * (and without booting the CMS in jsdom). `conversations.ts` owns the database
 * side and re-exports these.
 */

/** Shown until a real title can be derived from the first user message. */
export const DEFAULT_CONVERSATION_TITLE = 'New conversation'

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/
const TITLE_MAX = 70
const PREVIEW_MAX = 160

/** Marker appended by the chat composer for an uploaded image. */
const ATTACHMENT_NOTE = /\[attached media id=\d+[^\]]*\]/gi

/** The client's UUID-style id, used by useChat and AiActionLog.conversationId. */
export function isConversationKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value)
}

/** Removes the machine-readable attachment note the model needs but people do not. */
export function stripAttachmentNotes(text: string): string {
  return text.replace(ATTACHMENT_NOTE, '').replace(/\s+/g, ' ').trim()
}

function textOfParts(message: UIMessage | undefined): string {
  if (!message || !Array.isArray(message.parts)) return ''

  return message.parts
    .filter((part): part is { text: string; type: 'text' } => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim()
}

/** Cuts at a word boundary when possible, so titles do not end mid-word. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text

  const slice = text.slice(0, max)
  const boundary = slice.lastIndexOf(' ')

  return `${(boundary > max * 0.6 ? slice.slice(0, boundary) : slice).trimEnd()}…`
}

function firstUserText(messages: readonly UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== 'user') continue

    const text = stripAttachmentNotes(textOfParts(message))
    if (text) return text
  }

  return ''
}

/** A short, human title for the conversation list. */
export function deriveConversationTitle(messages: readonly UIMessage[]): string {
  const text = firstUserText(messages)

  if (!text) {
    return messages.some((message) => message.role === 'user')
      ? 'Image attachment'
      : DEFAULT_CONVERSATION_TITLE
  }

  // A paragraph pasted into the composer should not become a six-line title.
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] || text

  return truncate(firstSentence, TITLE_MAX)
}

/** The one-line "last thing said" shown under a title in the sidebar. */
export function deriveConversationPreview(messages: readonly UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant' && message.role !== 'user') continue

    const text = stripAttachmentNotes(textOfParts(message))
    if (text) return truncate(text.replace(/\s+/g, ' '), PREVIEW_MAX)
  }

  return ''
}

/** Relationship fields are an id at depth 0 and an object when populated. */
export function relationshipId(value: unknown): number | string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }

  return null
}
