/**
 * Pure normalization and validation for assistant-proposed product and brand
 * writes.
 *
 * Nothing here touches Payload. That is deliberate: these are the rules that
 * decide what the model is allowed to write, and keeping them free of database
 * access makes them directly unit-testable — which matters more here than
 * anywhere else in the assistant, because a bug in this file writes bad data
 * into the live catalogue.
 */

import type { FieldDiff, LooseDoc, ProductWriteOperation } from './types'

export type Validation = { error: string; ok: false } | { ok: true; value: unknown }

/** Upper bound on a plain-text description, to keep a runaway model from filling the DB. */
export const MAX_DESCRIPTION_CHARS = 10_000

const ok = (value: unknown): Validation => ({ ok: true, value })
const fail = (error: string): Validation => ({ error, ok: false })

/**
 * URL-safe slug. Deterministic on purpose: Payload's own slugifier is only
 * reachable through a field hook, and the assistant's slug must be decided at
 * staging time so the approval diff can show it.
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Lexical text node, matching what the editor itself stores. */
const textNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const paragraphNode = (text: string) => ({
  children: [textNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  type: 'paragraph',
  version: 1,
})

/**
 * Converts plain text (blank-line separated paragraphs, `-` bullets, `1.`
 * numbers) into the Lexical JSON the richText field expects.
 *
 * The assistant deals in plain text because that is what a model writes
 * reliably; this is the one place that shape is translated, so the tool schema
 * never has to expose editor internals.
 */
export function plainTextToRichText(input: string): LooseDoc {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  const children: LooseDoc[] = []
  let list: { items: string[]; type: 'bullet' | 'number' } | null = null

  const flushList = () => {
    if (!list) return

    children.push({
      children: list.items.map((item, index) => ({
        children: [textNode(item)],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'listitem',
        value: index + 1,
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      listType: list.type,
      start: 1,
      tag: list.type === 'bullet' ? 'ul' : 'ol',
      type: 'list',
      version: 1,
    })

    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.length === 0) {
      flushList()
      continue
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)

    if (bullet) {
      if (list?.type !== 'bullet') {
        flushList()
        list = { items: [], type: 'bullet' }
      }
      list.items.push(bullet[1])
      continue
    }

    if (numbered) {
      if (list?.type !== 'number') {
        flushList()
        list = { items: [], type: 'number' }
      }
      list.items.push(numbered[1])
      continue
    }

    flushList()
    children.push(paragraphNode(line))
  }

  flushList()

  return {
    root: {
      children: children.length > 0 ? children : [paragraphNode('')],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

/** The writable surface of a product, as accepted from the model. */
export type ProductFieldInput = {
  brand?: number | string
  categories?: Array<number | string>
  description?: string
  featuredInVideoShowcase?: boolean
  gallery?: Array<number | string>
  inventory?: number
  price?: number
  slug?: string
  status?: 'draft' | 'published'
  title?: string
}

type FieldRule = {
  /** Collection key written on apply. */
  key: string
  label: string
  validate: (value: unknown) => Validation
}

const asText = (value: unknown): Validation => {
  if (typeof value !== 'string') return fail('must be a string')
  const trimmed = value.trim()
  if (trimmed.length === 0) return fail('must not be empty')
  if (trimmed.length > 200) return fail('must be 200 characters or fewer')
  return ok(trimmed)
}

const asSlug = (value: unknown): Validation => {
  if (typeof value !== 'string') return fail('must be a string')
  const slug = normalizeSlug(value)

  if (slug.length === 0) {
    return fail('did not contain any URL-safe characters — pass a plain title and a slug will be derived')
  }

  return ok(slug)
}

const asMoney = (value: unknown): Validation => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail('must be a number')

  // Money is stored to the cent; round here so the approval diff shows exactly
  // what lands in the database rather than a float that differs in the 12th digit.
  const rounded = Math.round(value * 100) / 100

  if (rounded < 0) return fail('must not be negative')
  if (rounded > 1_000_000) return fail('looks like a typo (over 1,000,000)')

  return ok(rounded)
}

const asStock = (value: unknown): Validation => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fail('must be a whole number')
  }
  if (value < 0) return fail('must not be negative')
  if (value > 1_000_000) return fail('looks like a typo (over 1,000,000)')

  return ok(value)
}

const asBoolean = (value: unknown): Validation =>
  typeof value === 'boolean' ? ok(value) : fail('must be true or false')

const asIdList = (value: unknown): Validation => {
  if (!Array.isArray(value)) return fail('must be an array of ids')

  const ids: number[] = []

  for (const entry of value) {
    const id = typeof entry === 'string' ? Number(entry) : entry
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      return fail('must contain positive numeric ids only')
    }
    ids.push(id)
  }

  return ok(ids)
}

const asId = (value: unknown): Validation => {
  const id = typeof value === 'string' ? Number(value) : value

  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return fail('must be a positive numeric id')
  }

  return ok(id)
}

const asDescription = (value: unknown): Validation => {
  if (typeof value !== 'string') return fail('must be plain text')

  const trimmed = value.trim()

  if (trimmed.length === 0) return fail('must not be empty')

  if (trimmed.length > MAX_DESCRIPTION_CHARS) {
    return fail(`must be ${MAX_DESCRIPTION_CHARS} characters or fewer`)
  }

  return ok(plainTextToRichText(trimmed))
}

const asStatus = (value: unknown): Validation =>
  value === 'draft' || value === 'published' ? ok(value) : fail('must be "draft" or "published"')

/**
 * Field rules, keyed by the name the model uses. `price` is folded into the
 * plugin's two-column representation here so the model never has to know that
 * `priceInUSDEnabled` exists — but the flag is always written, because a price
 * without it is invisible in the admin and on the storefront.
 */
export const PRODUCT_RULES: Record<keyof ProductFieldInput, FieldRule> = {
  brand: { key: 'brand', label: 'Brand', validate: asId },
  categories: { key: 'categories', label: 'Categories', validate: asIdList },
  description: { key: 'description', label: 'Description', validate: asDescription },
  featuredInVideoShowcase: {
    key: 'featuredInVideoShowcase',
    label: 'Video showcase',
    validate: asBoolean,
  },
  gallery: { key: 'gallery', label: 'Gallery', validate: asIdList },
  inventory: { key: 'inventory', label: 'Stock', validate: asStock },
  price: { key: 'priceInUSD', label: 'Price (USD)', validate: asMoney },
  slug: { key: 'slug', label: 'Slug', validate: asSlug },
  status: { key: '_status', label: 'Status', validate: asStatus },
  title: { key: 'title', label: 'Title', validate: asText },
}

export type NormalizedFields = {
  /** Field labels for the approval UI, in the order the model supplied them. */
  diffs: FieldDiff[]
  /** Exactly what the Local API will be handed on apply. */
  fields: LooseDoc
}

/**
 * Validates the fields the model supplied and returns the write payload.
 *
 * `require` enforces fields a create cannot do without; an update passes an
 * empty list because a partial patch is the point.
 */
export function normalizeProductFields(
  input: ProductFieldInput,
  { require = [] as Array<keyof ProductFieldInput> } = {},
): { errors: string[]; ok: false } | { ok: true; result: NormalizedFields } {
  const errors: string[] = []
  const fields: LooseDoc = {}
  const diffs: FieldDiff[] = []

  for (const required of require) {
    const supplied = input[required]
    if (supplied === undefined || supplied === null || supplied === '') {
      errors.push(`"${required}" is required.`)
    }
  }

  for (const [name, raw] of Object.entries(input) as Array<[keyof ProductFieldInput, unknown]>) {
    if (raw === undefined || raw === null) continue

    const rule = PRODUCT_RULES[name]
    if (!rule) {
      errors.push(`"${name}" is not a field that can be written.`)
      continue
    }

    const validated = rule.validate(raw)

    if (!validated.ok) {
      errors.push(`"${name}" ${validated.error}.`)
      continue
    }

    fields[rule.key] = validated.value

    diffs.push({
      label: rule.label,
      // `price` and `status` are stored under different keys than the tool uses,
      // so the label is what the admin reads — the raw value is enough here.
      to: validated.value,
    })
  }

  // Only complain about an empty write when nothing was rejected: otherwise the
  // field errors above already explain why there is nothing left to write, and a
  // second message just makes the model's correction harder to read.
  if (errors.length === 0 && Object.keys(fields).length === 0) {
    errors.push('No fields to write — supply at least one field to change.')
  }

  if (errors.length > 0) return { errors, ok: false }

  // A price is only real to Payload when its currency flag is on.
  if (typeof fields.priceInUSD === 'number') {
    fields.priceInUSDEnabled = true
  }

  return { ok: true, result: { diffs, fields } }
}

/** Fields a brand can be written with. */
export type BrandFieldInput = {
  description?: string
  logo?: number | string
  slug?: string
  title?: string
}

const BRAND_RULES: Record<keyof BrandFieldInput, FieldRule> = {
  description: {
    key: 'description',
    label: 'Description',
    validate: (value) => (typeof value === 'string' ? ok(value.trim()) : fail('must be a string')),
  },
  logo: { key: 'logo', label: 'Logo', validate: asIdList },
  slug: { key: 'slug', label: 'Slug', validate: asSlug },
  title: { key: 'title', label: 'Title', validate: asText },
}

export function normalizeBrandFields(
  input: BrandFieldInput,
  { require = [] as Array<keyof BrandFieldInput> } = {},
): { errors: string[]; ok: false } | { ok: true; result: NormalizedFields } {
  const errors: string[] = []
  const fields: LooseDoc = {}
  const diffs: FieldDiff[] = []

  for (const required of require) {
    const supplied = input[required]
    if (supplied === undefined || supplied === null || supplied === '') {
      errors.push(`"${required}" is required.`)
    }
  }

  for (const [name, raw] of Object.entries(input) as Array<[keyof BrandFieldInput, unknown]>) {
    if (raw === undefined || raw === null) continue

    const rule = BRAND_RULES[name]
    if (!rule) {
      errors.push(`"${name}" is not a field that can be written.`)
      continue
    }

    const validated = rule.validate(raw)

    if (!validated.ok) {
      errors.push(`"${name}" ${validated.error}.`)
      continue
    }

    fields[rule.key] = validated.value
    diffs.push({ label: rule.label, to: validated.value })
  }

  if (errors.length === 0 && Object.keys(fields).length === 0) {
    errors.push('No fields to write — supply at least one field to change.')
  }

  if (errors.length > 0) return { errors, ok: false }

  return { ok: true, result: { diffs, fields } }
}

/** Derives a slug from a title. Used when the model supplies none. */
export function slugFromTitle(title: string): string {
  const slug = normalizeSlug(title)

  if (slug.length === 0) {
    throw new Error(`Could not derive a slug from "${title}". Supply a slug explicitly.`)
  }

  return slug
}

/** Human-readable one-liner for the proposal list. */
export function describeProductOperation(
  op: ProductWriteOperation | 'archive' | 'publish',
  title: string,
): string {
  switch (op) {
    case 'create':
      return `Create product "${title}"`
    case 'update':
      return `Update product "${title}"`
    case 'publish':
      return `Publish product "${title}"`
    case 'archive':
      return `Move product "${title}" back to draft`
  }
}
