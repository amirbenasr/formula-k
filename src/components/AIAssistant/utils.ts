import type { ActionMap, ConversationAction, ConversationSummary } from './types'

/** First name for greetings, falling back to the email local-part. */
export function displayFirstName(
  name?: null | string,
  email?: null | string,
): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed.split(/\s+/)[0]

  const local = email?.split('@')[0]?.trim()
  if (!local) return 'there'

  // "amir.hammami" and "amir_h" both read better as "Amir".
  const first = local.split(/[._-]/)[0]

  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there'
}

export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'

  return 'Good evening'
}

/**
 * Compact age for the sidebar ("just now", "4m", "2h", "3d", "Jan 5").
 *
 * Hand-rolled rather than date-fns' prose because the list is narrow: "about 2
 * hours ago" would be truncated on every row.
 */
export function relativeTime(value: Date | null | string | undefined, now: Date = new Date()): string {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000))

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export type ConversationGroup = { items: ConversationSummary[]; label: string }

/**
 * ChatGPT-style date buckets. The list arrives newest-first, so a single pass
 * preserves order inside each bucket.
 */
export function groupConversations(
  conversations: ConversationSummary[],
  now: Date = new Date(),
): ConversationGroup[] {
  const today = startOfDay(now)
  const buckets: ConversationGroup[] = [
    { items: [], label: 'Today' },
    { items: [], label: 'Yesterday' },
    { items: [], label: 'Previous 7 days' },
    { items: [], label: 'Older' },
  ]

  for (const conversation of conversations) {
    const stamp = conversation.lastMessageAt ?? conversation.updatedAt
    const time = stamp ? new Date(stamp).getTime() : Number.NaN

    if (Number.isNaN(time)) {
      buckets[3].items.push(conversation)
      continue
    }

    const day = startOfDay(new Date(time))

    if (day >= today) buckets[0].items.push(conversation)
    else if (day >= today - DAY_MS) buckets[1].items.push(conversation)
    else if (day >= today - DAY_MS * 6) buckets[2].items.push(conversation)
    else buckets[3].items.push(conversation)
  }

  return buckets.filter((bucket) => bucket.items.length > 0)
}

export function actionMapFromList(actions: ConversationAction[]): ActionMap {
  return Object.fromEntries(actions.map((action) => [action.actionId, action]))
}

/** Trims a value to something a table cell can hold. */
export function cell(value: unknown, max = 120): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ')

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)

  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error

  return fallback
}
