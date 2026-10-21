/**
 * Shared client-side shapes for the assistant UI.
 *
 * The server contracts live in `src/lib/ai/conversations.ts` (persistence) and
 * `src/endpoints/adminAi/conversations.ts` (HTTP). These mirror them so the React
 * components do not need to import server-only modules.
 */

import type { UIMessage } from 'ai'

export type ConversationSummary = {
  key: string
  lastMessageAt: string | null
  messageCount: number
  preview: string
  title: string
  updatedAt: string | null
}

export type ConversationActionStatus = 'applied' | 'cancelled' | 'failed' | 'pending'

export type ConversationAction = {
  actionId: string
  appliedAt: string | null
  error: string | null
  summary: string | null
  status: ConversationActionStatus
}

export type ActionMap = Record<string, ConversationAction>

export type LoadedConversation = {
  actions: ConversationAction[]
  messages: UIMessage[]
  summary: ConversationSummary
}

/** One row-level stock change, as returned by stage_inventory_update. */
export type StockChange = { from: number; label: string; to: number }

/** One resolved image, as returned by stage_product_images. */
export type ResolvedImage = {
  added?: boolean
  alt?: string
  credit?: string
  id: number
  source?: string
  sourceUrl?: string
  url?: string
}

/**
 * What the assistant returns for a catalogue operation. The model never renders
 * this: the tool returns the already-validated diff and the panel displays it,
 * so the admin reviews the same values applyAction will write.
 */
export type CataloguePreview = {
  diffs?: Array<{ from?: unknown; label: string; to?: unknown }>
  images?: ResolvedImage[]
  mode?: string
  op?: string
  primary?: ResolvedImage
  status?: 'draft' | 'published'
  targetKind?: string
  title?: string
  willCreate?: boolean
}

export type StagedOutput = {
  actionId?: number | string
  changes?: StockChange[]
  kind?: string
  preview?: CataloguePreview
  problems?: string[]
  staged?: boolean
  summary?: string
}

export type ApplyResponse = {
  applied?: StockChange[]
  appliedWrites?: Array<{ id?: number | string; label: string; op: string; status?: string }>
}

export type ToolPartShape = {
  errorText?: string
  input?: unknown
  output?: StagedOutput
  state?: string
  type: string
}
