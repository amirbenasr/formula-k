/**
 * Staging: turns a model request into a validated, human-reviewable proposal.
 *
 * Nothing in this file writes to the catalogue. Each `stage*` function reads the
 * current state, validates the requested change against it, and — only then —
 * inserts a `pending` row into `ai-action-logs`. The real write happens later in
 * `apply.ts`, behind the admin's Apply click.
 *
 * Validation here is not a formality. It is what makes the approval diff
 * trustworthy: by the time the admin sees "Price $1.00", the value has already
 * been coerced, bounded and checked for a slug collision.
 */

import type { Payload } from 'payload'

import type { BrandFieldInput, ProductFieldInput } from './validate'
import {
  describeProductOperation,
  normalizeBrandFields,
  normalizeProductFields,
  readGalleryRows,
  slugFromTitle,
  toGalleryRows,
  type GalleryRow,
} from './validate'
import { ImageImportError, importImageFromUrl } from './media-import'
import { findMediaById } from './media-lookup'
import type {
  ActionKind,
  AiToolContext,
  FieldDiff,
  ImageMode,
  LooseDoc,
  ResolvedImage,
  StagedWrite,
} from './types'

/** What the chat UI renders for a pending action. */
export type StagedPreview = {
  diffs: FieldDiff[]
  /** Resolved images, so the panel shows pictures rather than media ids. */
  images?: ResolvedImage[]
  /** Which gallery edit was requested. */
  mode?: ImageMode
  op: string
  /** The image that will sit at `gallery[0]`, i.e. the storefront primary. */
  primary?: ResolvedImage
  /** Populated by `stageProductStatus` so the UI can show the state change. */
  status?: 'draft' | 'published'
  targetKind: 'brand' | 'product'
  title: string
  /** Set for a create, so the UI can say "new product" rather than naming an id. */
  willCreate?: boolean
}

export type StageSuccess = {
  actionId: number | string
  kind: ActionKind
  problems?: string[]
  preview: StagedPreview
  staged: true
  summary: string
}

export type StageFailure = {
  problems: string[]
  staged: false
}

export type StageResult = StageFailure | StageSuccess

const asId = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined

/**
 * Resolves a product reference for an **edit**.
 *
 * Deliberately not `resolveTargets`: that resolver expands variant products into
 * one row per variant, which is right for stock but wrong for an edit — it can
 * make a single product look like several candidates. Editing needs one
 * unambiguous parent product, so the lookup is keyed on exact id, then exact
 * slug, then title.
 *
 * Returns candidates rather than picking one, so an ambiguous title is reported
 * to the admin instead of silently editing the wrong product.
 */
async function resolveProductRef(
  payload: Payload,
  ref: string,
): Promise<{ candidates: LooseDoc[]; product?: LooseDoc }> {
  const query = ref.trim()

  if (/^\d+$/.test(query)) {
    try {
      const byId = await payload.findByID({ collection: 'products', depth: 0, id: query })
      if (byId) return { candidates: [byId as LooseDoc], product: byId as LooseDoc }
    } catch {
      // Not a product id — fall through to slug and title.
    }
  }

  const bySlug = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 2,
    where: { slug: { equals: query } },
  })

  if (bySlug.docs.length > 0) {
    return { candidates: bySlug.docs as LooseDoc[], product: bySlug.docs[0] as LooseDoc }
  }

  const byTitle = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 6,
    where: { title: { contains: query } },
  })

  const candidates = byTitle.docs as LooseDoc[]

  return {
    candidates,
    ...(candidates.length === 1 ? { product: candidates[0] } : {}),
  }
}

/** Renders ambiguous candidates as a question back to the admin. */
function describeCandidates(candidates: LooseDoc[]): string {
  return candidates
    .map((candidate) => `"${candidate.title}" [id ${candidate.id}, slug ${candidate.slug}]`)
    .join('; ')
}

/** Labels a proposal so two staged rows are never confusable in the audit log. */
function summarize(kind: ActionKind, verb: string, subject: string): string {
  return `${verb} ${kind} "${subject}"`
}

async function logStage(
  { conversationId, payload, user }: AiToolContext,
  {
    changes,
    kind,
    summary,
    toolName,
  }: { changes: StagedWrite; kind: ActionKind; summary: string; toolName: string },
): Promise<number | string> {
  // Written in a single insert: `changes` holds the already-validated write, so
  // there is no window in which a pending row exists without the change it
  // describes.
  const action = await payload.create({
    collection: 'ai-action-logs',
    data: {
      changes: changes as unknown as LooseDoc,
      conversationId,
      kind,
      requestedBy: user.id,
      status: 'pending',
      summary,
      toolName,
    },
    depth: 0,
    overrideAccess: false,
    user,
  })

  return action.id
}

/**
 * Rejects a slug that another product already owns.
 *
 * Payload's own unique index would catch this at apply time, but it would throw
 * an opaque Postgres constraint error after the admin had already clicked
 * Apply. Checking at staging time turns that into a sentence the model can fix.
 */
async function slugTaken(
  payload: Payload,
  slug: string,
  excludeId?: number,
): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 10,
    where: { slug: { equals: slug } },
  })

  return docs.some((doc) => asId((doc as LooseDoc).id) !== excludeId)
}

async function brandSlugTaken(
  payload: Payload,
  slug: string,
  excludeId?: number,
): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'brands',
    depth: 0,
    limit: 10,
    where: { slug: { equals: slug } },
  })

  return docs.some((doc) => asId((doc as LooseDoc).id) !== excludeId)
}

export type StageProductWriteInput = {
  id?: number | string
  note?: string
  product: ProductFieldInput
}

/**
 * Stages a product create or field edit.
 *
 * `id` decides the operation: absent means create, present means update. The
 * caller never passes an operation name, so the model cannot describe a change
 * as an update while supplying no target — that mismatch produces an error here
 * instead of a silent create.
 */
export async function stageProductWrite(
  context: AiToolContext,
  { id, product }: StageProductWriteInput,
): Promise<StageResult> {
  const { payload } = context
  const problems: string[] = []

  const isCreate = id === undefined || id === null || id === ''

  // Resolve a supplied id/slug/title to exactly one parent product. Ambiguity is
  // refused rather than guessed, and an edit never resolves to a variant row.
  let targetId: number | undefined
  let currentTitle: string | undefined
  let currentGallery: GalleryRow[] = []

  if (!isCreate) {
    const { candidates, product: match } = await resolveProductRef(payload, String(id))

    if (candidates.length === 0) {
      return {
        problems: [`No product matched "${id}". Use find_products to get its id or slug first.`],
        staged: false,
      }
    }

    if (!match) {
      return {
        problems: [
          `"${id}" matched ${candidates.length} products (${describeCandidates(
            candidates,
          )}). Ask the admin which one, or pass the numeric product id.`,
        ],
        staged: false,
      }
    }

    targetId = asId(match.id)
    currentTitle = match.title as string
    currentGallery = readGalleryRows(match.gallery)
  }

  const validated = normalizeProductFields(product, {
    currentGallery,
    require: isCreate ? ['title', 'brand', 'price'] : [],
  })

  if (!validated.ok) {
    return { problems: validated.errors, staged: false }
  }

  const { diffs, fields } = validated.result

  // A create without an explicit slug derives one from the title, so the
  // storefront URL is never left null.
  if (isCreate) {
    const title = String(fields.title)
    const slug = typeof fields.slug === 'string' ? fields.slug : slugFromTitle(title)
    fields.slug = slug
  }

  const slug = typeof fields.slug === 'string' ? fields.slug : undefined

  if (slug && (await slugTaken(payload, slug, targetId))) {
    return {
      problems: [
        `Slug "${slug}" is already used by another product. Pick a different slug or update that product instead.`,
      ],
      staged: false,
    }
  }

  // A brand relationship must point at a real brand; a typo'd id would otherwise
  // fail validation deep inside Payload with a less useful message.
  if (fields.brand !== undefined) {
    try {
      await payload.findByID({
        collection: 'brands',
        depth: 0,
        id: fields.brand,
        overrideAccess: false,
        user: context.user,
      })
    } catch {
      problems.push(
        `Brand id ${String(fields.brand)} does not exist. Use find_brands to look up the brand, or stage_brand_create to create it.`,
      )
    }
  }

  if (problems.length > 0) return { problems, staged: false }

  const op = isCreate ? 'create' : 'update'
  const title = String(fields.title ?? currentTitle ?? '')

  const summary = describeProductOperation(op, title)

  const write: StagedWrite = {
    fields,
    op,
    slug,
    targetId,
    targetKind: 'product',
  }

  const actionId = await logStage(context, {
    changes: write,
    kind: 'product',
    summary,
    toolName: isCreate ? 'stage_product_create' : 'stage_product_update',
  })

  return {
    actionId,
    kind: 'product',
    preview: {
      diffs,
      op,
      targetKind: 'product',
      title,
      willCreate: isCreate,
    },
    staged: true,
    summary,
  }
}

export type StageProductStatusInput = {
  id: number | string
  publish: boolean
}

/**
 * Stages a publish (make visible) or archive (back to draft).
 *
 * Archiving is the assistant's only "removal": it is reversible, and a draft is
 * already invisible to customers, so nothing has to be deleted from a catalogue
 * that historical orders point at.
 */
export async function stageProductStatus(
  context: AiToolContext,
  { id, publish }: StageProductStatusInput,
): Promise<StageResult> {
  const { payload } = context
  const { candidates, product } = await resolveProductRef(payload, String(id))

  if (candidates.length === 0) {
    return {
      problems: [`No product matched "${id}". Use find_products to get its id or slug first.`],
      staged: false,
    }
  }

  if (!product) {
    return {
      problems: [
        `"${id}" matched ${candidates.length} products (${describeCandidates(
          candidates,
        )}). Pass the numeric product id to be unambiguous.`,
      ],
      staged: false,
    }
  }

  const productTitle = String(product.title)
  const productSlug = typeof product.slug === 'string' ? product.slug : undefined

  const current = await payload.findByID({
    collection: 'products',
    depth: 0,
    id: product.id,
    overrideAccess: false,
    user: context.user,
  })

  const currentStatus = (current as LooseDoc)._status === 'published' ? 'published' : 'draft'
  const nextStatus = publish ? 'published' : 'draft'

  if (currentStatus === nextStatus) {
    return {
      problems: [`"${productTitle}" is already ${nextStatus} — nothing to change.`],
      staged: false,
    }
  }

  const op = publish ? 'publish' : 'archive'
  const summary = describeProductOperation(op, productTitle)

  const write: StagedWrite = {
    fields: { _status: nextStatus },
    op,
    slug: productSlug,
    targetId: asId(product.id),
    targetKind: 'product',
  }

  const actionId = await logStage(context, {
    changes: write,
    kind: 'product',
    summary,
    toolName: 'stage_product_publish',
  })

  return {
    actionId,
    kind: 'product',
    preview: {
      diffs: [{ from: currentStatus, label: 'Status', to: nextStatus }],
      op,
      status: nextStatus,
      targetKind: 'product',
      title: productTitle,
    },
    staged: true,
    summary,
  }
}

export type StageBrandWriteInput = {
  brand: BrandFieldInput
  id?: number | string
}

/** Stages a brand create or field edit. Brands are referenced by id from products. */
export async function stageBrandWrite(
  context: AiToolContext,
  { brand, id }: StageBrandWriteInput,
): Promise<StageResult> {
  const { payload } = context
  const isCreate = id === undefined || id === null || id === ''

  let targetId: number | undefined
  let currentTitle: string | undefined

  if (!isCreate) {
    const query = String(id)

    const bySlug = await payload.find({
      collection: 'brands',
      depth: 0,
      limit: 5,
      overrideAccess: false,
      user: context.user,
      where: { slug: { equals: query } },
    })

    let matches = bySlug.docs as LooseDoc[]

    if (matches.length === 0) {
      const byTitle = await payload.find({
        collection: 'brands',
        depth: 0,
        limit: 5,
        overrideAccess: false,
        user: context.user,
        where: { title: { contains: query } },
      })
      matches = byTitle.docs as LooseDoc[]
    }

    if (matches.length === 0 && /^\d+$/.test(query)) {
      try {
        const byId = await payload.findByID({
          collection: 'brands',
          depth: 0,
          id: query,
          overrideAccess: false,
          user: context.user,
        })
        if (byId) matches = [byId as LooseDoc]
      } catch {
        // Not a brand id — fall through to the "no match" branch.
      }
    }

    if (matches.length === 0) {
      return {
        problems: [
          `No brand matched "${id}". Use find_brands to search, or omit the id to create a new brand.`,
        ],
        staged: false,
      }
    }

    if (matches.length > 1) {
      return {
        problems: [
          `"${id}" matched ${matches.length} brands (${matches
            .map((match) => `${match.title} [id ${match.id}]`)
            .join('; ')}). Pass the numeric brand id.`,
        ],
        staged: false,
      }
    }

    targetId = asId(matches[0].id)
    currentTitle = matches[0].title as string
  }

  const validated = normalizeBrandFields(brand, {
    require: isCreate ? ['title'] : [],
  })

  if (!validated.ok) {
    return { problems: validated.errors, staged: false }
  }

  const { diffs, fields } = validated.result

  if (isCreate) {
    const title = String(fields.title)
    const slug = typeof fields.slug === 'string' ? fields.slug : slugFromTitle(title)

    fields.slug = slug

    if (await brandSlugTaken(payload, slug, targetId)) {
      return {
        problems: [`A brand with slug "${slug}" already exists — update that brand instead.`],
        staged: false,
      }
    }
  }

  const op = isCreate ? 'create' : 'update'
  const title = String(fields.title ?? currentTitle ?? '')
  const summary = summarize('brand', isCreate ? 'Create' : 'Update', title)

  const write: StagedWrite = {
    fields,
    op,
    slug: typeof fields.slug === 'string' ? fields.slug : undefined,
    targetId,
    targetKind: 'brand',
  }

  const actionId = await logStage(context, {
    changes: write,
    kind: 'brand',
    summary,
    toolName: isCreate ? 'stage_brand_create' : 'stage_brand_update',
  })

  return {
    actionId,
    kind: 'brand',
    preview: { diffs, op, targetKind: 'brand', title, willCreate: isCreate },
    staged: true,
    summary,
  }
}

/** How many web images one proposal may pull at once. */
export const MAX_WEB_IMAGES = 3

const unique = (ids: number[]): number[] => [...new Set(ids)]

export type StageProductImagesInput = {
  id: number | string
  /** Media already in the library. */
  mediaIds?: number[]
  mode?: ImageMode
  note?: string
  /** Remote images to download into the library first. */
  webUrls?: Array<{
    credit?: string
    fallbackUrl?: string
    pageUrl?: string
    title?: string
    url: string
  }>
}

const imageCount = (count: number): string => `${count} image${count === 1 ? '' : 's'}`

/**
 * Stages a gallery change: set the primary image, add images, or replace the lot.
 *
 * This is the write half of the image pipeline; the resolution order that decides
 * *which* image lives in `tools.ts` and the system prompt. By the time this runs,
 * every candidate is a concrete media id.
 *
 * Note on ordering: a product's primary image is simply `gallery[0]` — the
 * storefront renders `gallery[0].image` as the main photo. So `set_primary` moves
 * one image to the front and leaves the rest untouched, which is why it is not
 * just "replace with a one-item list".
 *
 * Note on when media rows are created: web images are downloaded and inserted
 * into the media library here, at staging time, not at apply time. The approval
 * panel has to show the actual picture — approving "some URL" blind would defeat
 * the point of the review step — and downloading inside `applyAction`'s
 * transaction would mean a network call holding a database transaction open.
 * The trade-off is that a rejected proposal leaves an unused media row, which is
 * harmless: it sits in the library, correctly credited, and can be reused.
 */
export async function stageProductImages(
  context: AiToolContext,
  { id, mediaIds, mode = 'set_primary', webUrls }: StageProductImagesInput,
): Promise<StageResult> {
  const { payload } = context
  const problems: string[] = []

  const { candidates, product } = await resolveProductRef(payload, String(id))

  if (candidates.length === 0) {
    return {
      problems: [`No product matched "${id}". Use find_products to get its id or slug first.`],
      staged: false,
    }
  }

  if (!product) {
    return {
      problems: [
        `"${id}" matched ${candidates.length} products (${describeCandidates(
          candidates,
        )}). Pass the numeric product id to be unambiguous.`,
      ],
      staged: false,
    }
  }

  const productId = asId(product.id)

  if (productId === undefined) {
    return { problems: [`Product "${id}" has no numeric id.`], staged: false }
  }

  const productTitle = String(product.title ?? '')
  const currentRows = readGalleryRows(product.gallery)
  const currentIds = currentRows.map((row) => row.image)

  /** Images that will be attached, in the order the model listed them. */
  const resolved: ResolvedImage[] = []

  // Tier 1 and 2 land here as plain media ids: an image the admin attached in
  // the chat, or one `find_media` matched in the library.
  for (const mediaId of unique(mediaIds ?? [])) {
    const doc = await findMediaById(payload, context.user, mediaId)

    if (!doc) {
      problems.push(`Media id ${mediaId} does not exist. Use find_media to look up a real one.`)
      continue
    }

    resolved.push({
      alt: typeof doc.alt === 'string' ? doc.alt : undefined,
      credit: typeof doc.credit === 'string' ? doc.credit : undefined,
      id: mediaId,
      source: typeof doc.source === 'string' ? doc.source : undefined,
      sourceUrl: typeof doc.sourceUrl === 'string' ? doc.sourceUrl : undefined,
      url: typeof doc.url === 'string' ? doc.url : undefined,
    })
  }

  // Tier 3: pull each remote image into the library now.
  for (const candidate of (webUrls ?? []).slice(0, MAX_WEB_IMAGES)) {
    const alt = candidate.title?.trim() || `${productTitle} — product image`

    try {
      resolved.push(
        await importImageFromUrl({
          alt,
          credit: candidate.credit,
          fallbackUrl: candidate.fallbackUrl,
          payload,
          // The page the image was found on, sent as `Referer`: retail CDNs often
          // refuse an image request that does not come from their own page.
          referer: candidate.pageUrl,
          sourcePageUrl: candidate.pageUrl,
          url: candidate.url,
          user: context.user,
        }),
      )
    } catch (error) {
      problems.push(
        error instanceof ImageImportError
          ? error.message
          : `Could not import the image at ${candidate.url}.`,
      )
    }
  }

  if (resolved.length === 0) {
    return {
      problems:
        problems.length > 0
          ? problems
          : ['Nothing to attach — pass media ids from the library or web image URLs.'],
      staged: false,
    }
  }

  const incoming = resolved.map((image) => image.id)

  // Replacing is destructive, so it is all-or-nothing: if one of the requested
  // images failed to resolve, staging the rest would shrink the gallery without
  // the admin ever being told which picture is now missing.
  if (mode === 'replace' && problems.length > 0) {
    return {
      problems: [
        ...problems,
        'The gallery was not replaced, because not every requested image could be resolved. Stage the ones that worked with mode "append", or fix them and try again.',
      ],
      staged: false,
    }
  }

  const nextIds =
    mode === 'replace'
      ? unique(incoming)
      : mode === 'append'
        ? unique([...currentIds, ...incoming])
        : // set_primary: the new image first, every existing image kept behind it.
          unique([...incoming, ...currentIds])

  if (nextIds.length === 0) {
    return { problems: ['The gallery cannot be empty.'], staged: false }
  }

  // Nothing to do is worth saying out loud rather than staging a no-op proposal.
  const unchanged =
    nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])

  if (unchanged) {
    return {
      problems: [
        mode === 'append'
          ? `"${productTitle}" already has every one of those images — nothing to add.`
          : `"${productTitle}" already has that image as its primary image — nothing to change.`,
      ],
      staged: false,
    }
  }

  const nextRows = toGalleryRows(nextIds, currentRows)

  /**
   * Resolves the media rows for the *resulting* gallery, not just the new
   * images, so the approval panel can show the gallery exactly as it will look
   * — primary first, existing images included. A handful of extra reads, and the
   * only way an admin can tell whether the proposal is right.
   */
  const cache = new Map<number, ResolvedImage>(resolved.map((image) => [image.id, image]))

  const describe = async (id: number): Promise<ResolvedImage | null> => {
    const cached = cache.get(id)
    if (cached) return cached

    const doc = await findMediaById(payload, context.user, id)
    if (!doc) return null

    const image: ResolvedImage = {
      alt: typeof doc.alt === 'string' ? doc.alt : undefined,
      credit: typeof doc.credit === 'string' ? doc.credit : undefined,
      id,
      source: typeof doc.source === 'string' ? doc.source : undefined,
      sourceUrl: typeof doc.sourceUrl === 'string' ? doc.sourceUrl : undefined,
      url: typeof doc.url === 'string' ? doc.url : undefined,
    }

    cache.set(id, image)

    return image
  }

  const gallery: ResolvedImage[] = []
  const missing: number[] = []

  for (const row of nextRows) {
    const image = await describe(row.image)

    if (!image) {
      missing.push(row.image)
      continue
    }

    gallery.push(incoming.includes(row.image) ? { ...image, added: true } : { ...image })
  }

  if (missing.length > 0) {
    return {
      problems: [
        ...problems,
        `Media ${missing.map((id) => `#${id}`).join(', ')} no longer exists, so nothing was staged. Look the image up again with find_media.`,
      ],
      staged: false,
    }
  }

  const primaryImage = gallery[0]

  const summary =
    mode === 'set_primary'
      ? `Set primary image of "${productTitle}"`
      : mode === 'append'
        ? `Add ${imageCount(resolved.length)} to "${productTitle}"`
        : `Replace gallery of "${productTitle}" with ${imageCount(nextIds.length)}`

  const write: StagedWrite = {
    fields: { gallery: nextRows },
    op: 'update',
    slug: typeof product.slug === 'string' ? product.slug : undefined,
    targetId: productId,
    targetKind: 'product',
  }

  const actionId = await logStage(context, {
    changes: write,
    kind: 'product',
    summary,
    toolName: 'stage_product_images',
  })

  return {
    actionId,
    kind: 'product',
    preview: {
      diffs: [
        {
          from: imageCount(currentIds.length),
          label: 'Gallery',
          to: imageCount(nextIds.length),
        },
      ],
      images: gallery,
      mode,
      op: 'update',
      ...(primaryImage ? { primary: primaryImage } : {}),
      targetKind: 'product',
      title: productTitle,
    },
    ...(problems.length > 0 ? { problems } : {}),
    staged: true,
    summary,
  }
}

