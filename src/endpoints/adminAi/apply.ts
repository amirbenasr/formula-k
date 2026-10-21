import { applyAction } from '@/lib/ai/apply'
import { APIError, type Endpoint } from 'payload'

import { requireAssistantAdmin } from './guard'

/**
 * Applies a staged action. Called only from the chat UI when a human clicks
 * Apply — the model has no tool that reaches this path, which is what makes the
 * dry-run guarantee real rather than advisory.
 */
export const adminAiApplyEndpoint: Endpoint = {
  path: '/admin-ai/apply',
  method: 'post',
  handler: async (req) => {
    const user = requireAssistantAdmin(req)

    let body: { actionId?: number | string } = {}

    try {
      body = (await req.json?.()) ?? {}
    } catch {
      throw new APIError('Expected a JSON body with `actionId`.', 400)
    }

    if (body.actionId === undefined || body.actionId === null || body.actionId === '') {
      throw new APIError('`actionId` is required.', 400)
    }

    const result = await applyAction({
      actionId: body.actionId,
      payload: req.payload,
      user,
    })

    return Response.json(result)
  },
}
