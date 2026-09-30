import { checkRole } from '@/access/utilities'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { buildTools } from '@/lib/ai/tools'
import { getChatModel, thinkingProviderOptions } from '@/lib/ai/provider'
import type { User } from '@/payload-types'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { APIError, type Endpoint } from 'payload'

/**
 * Streaming chat endpoint backing the admin assistant at /admin/ai.
 *
 * Custom endpoints are unauthenticated by default, so the first thing we do is
 * require a signed-in admin. Every tool then reads through the Local API with
 * `overrideAccess: false` and this same user, so the assistant can never see or
 * do more than the person driving it.
 */
export const adminAiChatEndpoint: Endpoint = {
  path: '/admin-ai/chat',
  method: 'post',
  handler: async (req) => {
    const { user } = req

    if (!user || !checkRole(['admin'], user as User)) {
      throw new APIError('Unauthorized — the AI assistant is restricted to admins.', 401)
    }

    const admin = user as User

    let body: { conversationId?: string; messages?: UIMessage[] } = {}

    try {
      // `req.json` is optional on PayloadRequest (it extends Partial<Request>),
      // and Payload does not pre-parse custom endpoint bodies for us.
      body = (await req.json?.()) ?? {}
    } catch {
      throw new APIError('Expected a JSON body with `messages`.', 400)
    }

    const messages = body.messages ?? []

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new APIError('No messages supplied.', 400)
    }

    const conversationId = body.conversationId || crypto.randomUUID()

    // Tools are built per request and close over this admin's identity, so no
    // tool can escalate beyond the caller.
    const tools = buildTools({ conversationId, payload: req.payload, user: admin })

    const result = streamText({
      messages: await convertToModelMessages(messages),
      model: getChatModel(),
      providerOptions: thinkingProviderOptions(),
      // Bounded so a confused model cannot spin indefinitely against the database.
      stopWhen: isStepCount(8),
      system: buildSystemPrompt({ userName: admin.name || admin.email }),
      tools,
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, tools }),
    })
  },
}
