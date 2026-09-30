import { APIError, type Payload } from 'payload'

import type { User } from '@/payload-types'

import type {
  ActionKind,
  AppliedWrite,
  CatalogueStagedWrite,
  PlannedChange,
  LooseDoc,
  StagedWrite,
} from './types'

export type InventoryApplied = { drift?: string; label: string; to: number }

export type ApplyResult = {
  actionId: number | string
  /** Set for product/brand actions, describing exactly what was written. */
  appliedWrites?: AppliedWrite[]
  /** Set for inventory actions. */
  applied?: InventoryApplied[]
  kind: ActionKind
  status: 'applied' | 'failed'
}

/**
 * Hands an already-validated write to the Local API.
 *
 * The `data` cast is the only one in the assistant's write path, and it is
 * narrow on purpose: it asserts something the runtime already guarantees.
 * `normalizeProductFields` / `normalizeBrandFields` built this exact object and
 * checked every field before the change was ever staged, and `applyCatalogue`
 * only ever routes a product payload to `products` and a brand payload to
 * `brands`.
 *
 * It is needed because `fields` is a JSON object (LooseDoc, an index signature)
 * rather than a statically-shaped one: Payload cannot narrow it, so the call
 * lands on the drafts-enabled overload and fails with a misleading "property
 * `draft` is missing". Relaxing `data` lets the collection literal pick the
 * right overload, which keeps every other property of these calls type-checked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WriteData = any

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

  const record = action as LooseDoc
  const kind = (record.kind ?? 'inventory') as ActionKind
  const write = record.changes as StagedWrite | undefined

  if (!write || typeof write !== 'object') {
    throw new APIError('This action has no changes to apply.', 400)
  }

  // Postgres adapters hand back a numeric transaction id; Payload's `req.transactionID`
  // is typed `string`. Normalising once here keeps the cast in a single place.
  const started = await payload.db.beginTransaction?.()
  const transactionID = started === undefined || started === null ? undefined : String(started)
  let applied: InventoryApplied[] = []
  let appliedWrites: AppliedWrite[] = []

  try {
    if (kind === 'inventory') {
      applied = await applyInventory({ payload, transactionID, user, write })
    } else if (kind === 'product' || kind === 'brand') {
      if (write.targetKind === 'inventory') {
        throw new APIError('This action is a product/brand action but carries a stock change.', 400)
      }

      appliedWrites = [await applyCatalogue({ kind, payload, transactionID, user, write })]
    } else {
      throw new APIError(`Unknown action kind "${String(kind)}".`, 400)
    }

    if (transactionID) await payload.db.commitTransaction?.(transactionID)
  } catch (error) {
    if (transactionID) await payload.db.rollbackTransaction?.(transactionID)

    await payload.update({
      id: String(record.id),
      collection: 'ai-action-logs',
      data: { error: error instanceof Error ? error.message : String(error), status: 'failed' },
      overrideAccess: false,
      user,
    })

    throw error
  }

  await payload.update({
    id: String(record.id),
    collection: 'ai-action-logs',
    data: {
      appliedAt: new Date().toISOString(),
      result: applied.length > 0 ? applied : appliedWrites,
      status: 'applied',
    },
    overrideAccess: false,
    user,
  })

  return {
    actionId: String(record.id),
    ...(applied.length > 0 ? { applied } : {}),
    ...(appliedWrites.length > 0 ? { appliedWrites } : {}),
    kind,
    status: 'applied',
  }
}

/** Executes a stock change, capturing drift for the audit trail. */
async function applyInventory({
  payload,
  transactionID,
  user,
  write,
}: {
  payload: Payload
  transactionID?: null | string
  user: User
  write: StagedWrite
}): Promise<InventoryApplied[]> {
  if (write.targetKind !== 'inventory' || !Array.isArray(write.changes)) {
    throw new APIError('This action has no stock changes to apply.', 400)
  }

  // Narrowed by the guard above: an inventory write always carries row changes.
  const changes: PlannedChange[] = write.changes

  if (changes.length === 0) {
    throw new APIError('This action has no stock changes to apply.', 400)
  }

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

  const applied: InventoryApplied[] = []

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

    const drifted = drift.find((entry) => entry.label === change.label)

    applied.push({
      drift: drifted ? `stock had moved to ${drifted.found}` : undefined,
      label: change.label,
      to: change.to,
    })
  }

  return applied
}

/**
 * Executes a product or brand create/edit/publish.
 *
 * `write.fields` was validated when the proposal was staged and is handed to the
 * Local API verbatim. The two things re-checked here are the ones that can have
 * changed since staging: the target still exists, and the slug is still free.
 */
async function applyCatalogue({
  kind,
  payload,
  transactionID,
  user,
  write,
}: {
  kind: 'brand' | 'product'
  payload: Payload
  transactionID?: null | string
  user: User
  write: CatalogueStagedWrite
}): Promise<AppliedWrite> {
  const collection = kind === 'product' ? 'products' : 'brands'
  const { fields, op, slug, targetId } = write

  const req = transactionID ? { transactionID } : undefined

  if (op === 'create') {
    // Re-checked inside the transaction: the unique index would also catch a
    // collision, but this produces a sentence instead of a Postgres error.
    if (slug) {
      const clash = await payload.find({
        collection,
        depth: 0,
        limit: 1,
        overrideAccess: false,
        req,
        user,
        where: { slug: { equals: slug } },
      })

      if (clash.docs.length > 0) {
        throw new APIError(
          `A ${kind} with slug "${slug}" was created after this was staged. Nothing was written — stage the change again.`,
          409,
        )
      }
    }

    // Branched per collection on purpose: passing the union `'products' | 'brands'`
    // to a single `payload.create` call makes Payload's per-collection generics
    // collapse into an unsatisfiable overload union.
    if (kind === 'product') {
      const created = await payload.create({
        collection: 'products',
        data: fields as WriteData,
        overrideAccess: false,
        req,
        user,
      })

      const createdDoc = created as LooseDoc

      return {
        id: createdDoc.id,
        label: String(createdDoc.title ?? slug ?? createdDoc.id),
        op,
        status: createdDoc._status === 'published' ? 'published' : 'draft',
      }
    }

    const created = await payload.create({
      collection: 'brands',
      data: fields as WriteData,
      overrideAccess: false,
      req,
      user,
    })

    const createdDoc = created as LooseDoc

    return {
      id: createdDoc.id,
      label: String(createdDoc.title ?? slug ?? createdDoc.id),
      op,
    }
  }

  if (targetId === undefined) {
    throw new APIError(`This ${kind} change has no target to update.`, 400)
  }

  // Confirm the row still exists (and has not been trashed) before writing.
  await payload.findByID({
    collection,
    depth: 0,
    id: targetId,
    overrideAccess: false,
    req,
    user,
  })

  // Branched per collection for the same reason as the create path above: the
  // union literal does not satisfy Payload's per-collection generic overloads.
  if (kind === 'product') {
    const updated = await payload.update({
      collection: 'products',
      data: fields as WriteData,
      depth: 0,
      id: targetId,
      overrideAccess: false,
      req,
      user,
    })

    const updatedDoc = updated as LooseDoc

    return {
      id: updatedDoc.id,
      label: String(updatedDoc.title ?? slug ?? targetId),
      op,
      status: updatedDoc._status === 'published' ? 'published' : 'draft',
    }
  }

  const updated = await payload.update({
    collection: 'brands',
    data: fields as WriteData,
    depth: 0,
    id: targetId,
    overrideAccess: false,
    req,
    user,
  })

  const updatedDoc = updated as LooseDoc

  return {
    id: updatedDoc.id,
    label: String(updatedDoc.title ?? slug ?? targetId),
    op,
  }
}
