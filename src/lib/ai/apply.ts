import { APIError, type Payload } from 'payload'

import type { User } from '@/payload-types'

import type { PlannedChange, LooseDoc } from './types'

export type ApplyResult = {
  actionId: number | string
  applied: Array<{ drift?: string; label: string; to: number }>
  status: 'applied' | 'failed'
}

/**
 * Performs the real writes for a staged action.
 *
 * This is the ONLY place the assistant's proposed changes reach the catalogue.
 * The model cannot call it: it is reachable only from the admin-authenticated
 * `/api/admin-ai/apply` endpoint, which the chat UI calls when a human clicks
 * Apply.
 *
 * All updates share one Postgres transaction, because a stock count is a single
 * business fact — a partial apply would leave the catalogue in a state no human
 * ever intended.
 */
export async function applyAction({
  actionId,
  payload,
  user,
}: {
  actionId: number | string
  payload: Payload
  user: User
}): Promise<ApplyResult> {
  // Runs as the signed-in admin: the collection's own access control still applies.
  const action = await payload.findByID({
    collection: 'ai-action-logs',
    depth: 0,
    id: actionId,
    overrideAccess: false,
    user,
  })

  if (!action) {
    throw new APIError('Pending action not found.', 404)
  }

  if (action.status !== 'pending') {
    throw new APIError(`This action was already "${action.status}" and cannot be applied again.`, 409)
  }

  const changes = (action.changes ?? []) as PlannedChange[]

  if (!Array.isArray(changes) || changes.length === 0) {
    throw new APIError('This action has no changes to apply.', 400)
  }

  // Guard against the catalogue moving between staging and approval.
  const drift: Array<{ expected: number; label: string; found: number }> = []

  for (const change of changes) {
    const collection = change.targetKind === 'variant' ? 'variants' : 'products'

    const current = await payload.findByID({
      collection,
      depth: 0,
      id: change.targetId,
      overrideAccess: false,
      user,
    })

    const currentDoc = current as LooseDoc
    const currentStock = typeof currentDoc?.inventory === 'number' ? currentDoc.inventory : 0

    if (currentStock !== change.from) {
      drift.push({ expected: change.from, found: currentStock, label: change.label })
    }
  }

  const transactionID = await payload.db.beginTransaction?.()
  const applied: ApplyResult['applied'] = []

  try {
    for (const change of changes) {
      const collection = change.targetKind === 'variant' ? 'variants' : 'products'

      await payload.update({
        id: change.targetId,
        collection,
        data: { inventory: change.to },
        overrideAccess: false,
        req: transactionID ? { transactionID } : undefined,
        user,
      })

      applied.push({
        drift: drift.find((entry) => entry.label === change.label)
          ? `stock had moved to ${drift.find((entry) => entry.label === change.label)?.found}`
          : undefined,
        label: change.label,
        to: change.to,
      })
    }

    if (transactionID) await payload.db.commitTransaction?.(transactionID)
  } catch (error) {
    if (transactionID) await payload.db.rollbackTransaction?.(transactionID)

    await payload.update({
      id: action.id,
      collection: 'ai-action-logs',
      data: { error: error instanceof Error ? error.message : String(error), status: 'failed' },
      overrideAccess: false,
      user,
    })

    throw error
  }

  await payload.update({
    id: action.id,
    collection: 'ai-action-logs',
    data: { appliedAt: new Date().toISOString(), result: applied, status: 'applied' },
    overrideAccess: false,
    user,
  })

  return { actionId: action.id, applied, status: 'applied' }
}
