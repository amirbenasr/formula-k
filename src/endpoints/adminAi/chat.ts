import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { buildTools } from '@/lib/ai/tools'
import { getChatModel, thinkingProviderOptions } from '@/lib/ai/provider'
import { assertConversationKey, persistConversation } from '@/lib/ai/conversations'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { APIError, type Endpoint } from 'payload'

import { requireAssistantAdmin } from './guard'

/**
 * Streaming chat endpoint backing the admin assistant at /admin/ai.
 *
 * Custom endpoints are unauthenticated by default, so the first thing we do is
 * require a signed-in admin. Every tool then reads through the Local API with
 * `overrideAccess: false` and this same user, so the assistant can never see or
 * do more than the person driving it.
 *
 * The transcript is persisted twice: once on arrival (the admin's message
 * survives a provider outage) and once in the UI stream's `onEnd` callback with
 * the assistant's reply. `onEnd` runs while the stream is still owned by this
 * request, so the write is not racing Response completion.
 */
export const adminAiChatEndpoint: Endpoint = {
  path: '/admin-ai/chat',
  method: 'post',
  handler: async (req) => {
    const admin = requireAssistantAdmin(req)

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

    // A conversation started in the dashboard or the "New chat" button arrives
    // with a client UUID; older tabs without one still get a stable id.
    const conversationId = body.conversationId
      ? assertConversationKey(body.conversationId)
      : crypto.randomUUID()

    // Persist before calling the provider. If DeepSeek is down or the admin
    // closes the tab mid-turn, the question is still in their history.
    await persistConversation({
      key: conversationId,
      messages,
      payload: req.payload,
      user: admin,
    })

    // Tools are built per request and close over this admin's identity, so no
    // tool can escalate beyond the caller.
    const tools = buildTools({ conversationId, payload: req.payload, user: admin })

    const startedAt = Date.now()

    /**
     * Observability.
     *
     * A failed turn used to be invisible: the endpoint returns 200 as soon as the
     * stream opens, so Vercel's request log shows a success even when a tool
     * failed or the model gave up. These three lines make the tool loop readable
     * in the function logs, which is where you look when the chat says "I
     * couldn't" and you need to know whether the provider, the tool or the model
     * was at fault. Tool arguments are logged (they are the useful part, and this
     * is an admin-only surface); the admin's message text is not.
     */
    const result = streamText({
      messages: await convertToModelMessages(messages),
      model: getChatModel(),
      onError: ({ error }) => {
        console.error(`[ai/chat] stream error conversation=${conversationId}:`, error)
      },
      onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls) {
          console.info(
            `[ai/chat] tool=${call.toolName} args=${JSON.stringify(call.input ?? {}).slice(0, 240)} conversation=${conversationId}`,
          )
        }
      },
      providerOptions: thinkingProviderOptions(),
      // Bounded so a confused model cannot spin indefinitely against the database.
      stopWhen: isStepCount(8),
      system: buildSystemPrompt({ userName: admin.name || admin.email }),
      tools,
    })

    console.info(`[ai/chat] start conversation=${conversationId} messages=${messages.length}`)

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        // Passing the originals puts the stream in persistence mode: the
        // assistant reply gets its final id, and `onEnd` receives the complete
        // transcript instead of just the newly streamed message.
        originalMessages: messages,
        stream: result.stream,
        tools,
        onEnd: async ({ messages: finalMessages }) => {
          try {
            await persistConversation({
              key: conversationId,
              messages: finalMessages,
              payload: req.payload,
              user: admin,
            })
          } catch (error) {
            console.error(`[ai/chat] persist failed conversation=${conversationId}:`, error)
          }

          console.info(
            `[ai/chat] done conversation=${conversationId} elapsed=${Date.now() - startedAt}ms`,
          )
        },
      }),
    })
  },
}
