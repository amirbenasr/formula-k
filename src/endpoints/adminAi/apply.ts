import { checkRole } from '@/access/utilities'
import { applyAction } from '@/lib/ai/apply'
import type { User } from '@/payload-types'
import { APIError, type Endpoint } from 'payload'

/**
 * Applies a staged action. Called only from the chat UI when a human clicks
 * Apply — the model has no tool that reaches this path, which is what makes the
 * dry-run guarantee real rather than advisory.
 */
export const adminAiApplyEndpoint: Endpoint = {
  path: '/admin-ai/apply',
  method: 'post',
  handler: async (req) => {
    const { user } = req

    if (!user || !checkRole(['admin'], user as User)) {
      throw new APIError('Unauthorized — the AI assistant is restricted to admins.', 401)
    }

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
      user: user as User,
    })

    return Response.json(result)
  },
}
