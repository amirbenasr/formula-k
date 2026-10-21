import {
  assertConversationKey,
  deleteConversation,
  listConversations,
  loadConversation,
  renameConversation,
} from '@/lib/ai/conversations'
import { APIError, type Endpoint } from 'payload'

import { requireAssistantAdmin } from './guard'

function keyFrom(req: { routeParams?: Record<string, unknown> }): string {
  return assertConversationKey(req.routeParams?.key)
}

/** GET /api/admin-ai/conversations — the sidebar list, newest first. */
export const adminAiConversationsListEndpoint: Endpoint = {
  path: '/admin-ai/conversations',
  method: 'get',
  handler: async (req) => {
    const user = requireAssistantAdmin(req)
    const search = req.searchParams?.get('search')?.trim() ?? ''
    const requested = Number(req.searchParams?.get('limit') ?? 100)
    const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 200) : 100

    const conversations = await listConversations({
      limit,
      payload: req.payload,
      search: search || undefined,
      user,
    })

    return Response.json({ conversations })
  },
}

/** GET /api/admin-ai/conversations/:key — hydrate one transcript. */
export const adminAiConversationEndpoint: Endpoint = {
  path: '/admin-ai/conversations/:key',
  method: 'get',
  handler: async (req) => {
    const user = requireAssistantAdmin(req)
    const conversation = await loadConversation({
      key: keyFrom(req),
      payload: req.payload,
      user,
    })

    return Response.json(conversation)
  },
}

/** PATCH /api/admin-ai/conversations/:key — rename a conversation. */
export const adminAiConversationUpdateEndpoint: Endpoint = {
  path: '/admin-ai/conversations/:key',
  method: 'patch',
  handler: async (req) => {
    const user = requireAssistantAdmin(req)
    const key = keyFrom(req)

    let body: { title?: unknown } = {}
    try {
      body = (await req.json?.()) ?? {}
    } catch {
      throw new APIError('Expected a JSON body with `title`.', 400)
    }

    const conversation = await renameConversation({
      key,
      payload: req.payload,
      title: body.title,
      user,
    })

    return Response.json({ conversation })
  },
}

/** DELETE /api/admin-ai/conversations/:key — forget a conversation. */
export const adminAiConversationDeleteEndpoint: Endpoint = {
  path: '/admin-ai/conversations/:key',
  method: 'delete',
  handler: async (req) => {
    const user = requireAssistantAdmin(req)

    await deleteConversation({ key: keyFrom(req), payload: req.payload, user })

    return Response.json({ deleted: true })
  },
}
