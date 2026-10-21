import { describe, expect, it } from 'vitest'

import {
  MAX_DESCRIPTION_CHARS,
  normalizeBrandFields,
  normalizeProductFields,
  normalizeSlug,
  plainTextToRichText,
  readGalleryRows,
  slugFromTitle,
  toGalleryRows,
} from '../validate'

describe('normalizeSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeSlug('Lip Sleeping Mask EX (Berry) 3g')).toBe('lip-sleeping-mask-ex-berry-3g')
  })

  it('strips accents rather than dropping the letter', () => {
    expect(normalizeSlug('Crème Écran Solaire')).toBe('creme-ecran-solaire')
  })

  it('collapses separators and trims edges', () => {
    expect(normalizeSlug('  --Anua__Tonique 77% -- ')).toBe('anua-tonique-77')
  })

  it('returns an empty string when nothing URL-safe survives', () => {
    expect(normalizeSlug('!!!')).toBe('')
  })
})

describe('slugFromTitle', () => {
  it('derives a slug from a title', () => {
    expect(slugFromTitle('Bouncy Sleeping Mask 10ml')).toBe('bouncy-sleeping-mask-10ml')
  })

  it('throws instead of producing an empty slug', () => {
    expect(() => slugFromTitle('★★★')).toThrow(/Could not derive a slug/)
  })
})

describe('plainTextToRichText', () => {
  const childrenOf = (text: string) => plainTextToRichText(text).root.children

  it('wraps a single line in one paragraph', () => {
    const children = childrenOf('A hydrating mask.')

    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('paragraph')
    expect(children[0].children[0].text).toBe('A hydrating mask.')
  })

  it('splits blank-line separated paragraphs', () => {
    const children = childrenOf('First.\n\nSecond.')

    expect(children).toHaveLength(2)
    expect(children.map((node: { type: string }) => node.type)).toEqual(['paragraph', 'paragraph'])
  })

  it('groups dash-prefixed lines into one bullet list', () => {
    const children = childrenOf('Includes:\n- Berry extract\n- Vitamin C')

    expect(children).toHaveLength(2)
    expect(children[1].type).toBe('list')
    expect(children[1].listType).toBe('bullet')
    expect(children[1].children).toHaveLength(2)
  })

  it('gives ordered lists sequential item values', () => {
    const children = childrenOf('1. Cleanse\n2. Apply')
    const list = children[0]

    expect(list.type).toBe('list')
    expect(list.listType).toBe('number')
    expect(list.children.map((item: { value: number }) => item.value)).toEqual([1, 2])
  })

  it('still produces a valid document for empty input', () => {
    const children = childrenOf('')

    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('paragraph')
  })
})

describe('normalizeProductFields', () => {
  it('maps `price` onto the plugin currency pair', () => {
    const result = normalizeProductFields({ price: 1 })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The flag is what makes the price visible in the admin and storefront.
    expect(result.result.fields).toEqual({ priceInUSD: 1, priceInUSDEnabled: true })
  })

  it('maps the model-facing field names onto collection keys', () => {
    const result = normalizeProductFields({
      brand: 3,
      inventory: 9,
      slug: 'A Nice Slug',
      status: 'published',
      title: '  Berry Mask  ',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields).toEqual({
      _status: 'published',
      brand: 3,
      inventory: 9,
      slug: 'a-nice-slug',
      title: 'Berry Mask',
    })
  })

  it('rounds money to the cent so the diff matches what is written', () => {
    const result = normalizeProductFields({ price: 19.999 })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields.priceInUSD).toBe(20)
  })

  it('converts a description to rich text', () => {
    const result = normalizeProductFields({ description: 'Hello' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const description = result.result.fields.description
    expect(description.root.type).toBe('root')
    expect(description.root.children[0].children[0].text).toBe('Hello')
  })

  it('flags an explicitly supplied invalid field by name', () => {
    const result = normalizeProductFields({ price: -5, title: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toContain('"price" must not be negative.')
    expect(result.errors).toContain('"title" must not be empty.')
  })

  it('rejects a non-positive brand id', () => {
    const result = normalizeProductFields({ brand: 0 })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual(['"brand" must be a positive numeric id.'])
  })

  it('rejects a non-integer stock count', () => {
    const result = normalizeProductFields({ inventory: 1.5 })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual(['"inventory" must be a whole number.'])
  })

  it('ignores undefined fields so a partial patch stays partial', () => {
    const result = normalizeProductFields({ price: 5, title: undefined })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields).toEqual({ priceInUSD: 5, priceInUSDEnabled: true })
  })

  it('refuses an empty write', () => {
    const result = normalizeProductFields({})

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual(['No fields to write — supply at least one field to change.'])
  })

  it('enforces required fields on create', () => {
    const result = normalizeProductFields({ title: 'Only a title' }, { require: ['title', 'brand', 'price'] })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toContain('"brand" is required.')
    expect(result.errors).toContain('"price" is required.')
  })

  it('rejects a description longer than the cap', () => {
    const result = normalizeProductFields({ description: 'x'.repeat(MAX_DESCRIPTION_CHARS + 1) })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual([`"description" must be ${MAX_DESCRIPTION_CHARS} characters or fewer.`])
  })

  it('reports the label used in the approval diff', () => {
    const result = normalizeProductFields({ inventory: 9, price: 1, title: 'Mask' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.diffs.map((diff) => diff.label)).toEqual(['Stock', 'Price (TND)', 'Title'])
  })
})

describe('normalizeBrandFields', () => {
  it('requires a title on create', () => {
    const result = normalizeBrandFields({ slug: 'laneige' }, { require: ['title'] })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual(['"title" is required.'])
  })

  it('allows a partial brand edit and normalizes the slug', () => {
    const result = normalizeBrandFields({ slug: 'La Neige' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields).toEqual({ slug: 'la-neige' })
  })

  it('refuses a brand write with no fields', () => {
    const result = normalizeBrandFields({})

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual(['No fields to write — supply at least one field to change.'])
  })

  /**
   * `logo` is a single upload relation, so an array here would be rejected by the
   * collection — a bug this suite exists to keep from coming back.
   */
  it('writes a brand logo as a single media id, not an array', () => {
    const result = normalizeBrandFields({ logo: 12 })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields.logo).toBe(12)
    expect(result.result.diffs).toEqual([{ label: 'Logo', to: 'Media #12' }])
  })
})

describe('readGalleryRows', () => {
  it('reads ids from a flat array of ids', () => {
    expect(readGalleryRows([3, 7])).toEqual([{ image: 3 }, { image: 7 }])
  })

  it('reads rows whose image is a populated media document', () => {
    expect(readGalleryRows([{ id: 'row1', image: { id: 5, url: '/x.jpg' } }])).toEqual([
      { image: 5 },
    ])
  })

  it('keeps the variantOption binding', () => {
    expect(readGalleryRows([{ image: 5, variantOption: 9 }])).toEqual([
      { image: 5, variantOption: 9 },
    ])
  })

  it('skips rows with no usable image', () => {
    expect(readGalleryRows([{ variantOption: 9 }, null, 'nope', { image: 0 }])).toEqual([])
  })

  it('returns an empty list for a non-array', () => {
    expect(readGalleryRows(null)).toEqual([])
    expect(readGalleryRows(undefined)).toEqual([])
  })
})

describe('toGalleryRows', () => {
  it('builds the object rows the collection actually stores', () => {
    expect(toGalleryRows([4, 2])).toEqual([{ image: 4 }, { image: 2 }])
  })

  it('preserves variant bindings for images that survive a reorder', () => {
    const current = [
      { image: 4, variantOption: 11 },
      { image: 2 },
    ]

    expect(toGalleryRows([2, 4], current)).toEqual([{ image: 2 }, { image: 4, variantOption: 11 }])
  })

  it('drops the binding of an image that is no longer listed', () => {
    expect(toGalleryRows([9], [{ image: 4, variantOption: 11 }])).toEqual([{ image: 9 }])
  })
})

describe('normalizeProductFields — gallery', () => {
  it('maps media ids to the array-of-objects shape', () => {
    const result = normalizeProductFields({ gallery: [12, 8] })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The whole point of the fix: a flat `[12, 8]` here would store nothing.
    expect(result.result.fields.gallery).toEqual([{ image: 12 }, { image: 8 }])
  })

  it('carries variantOption over when editing an existing gallery', () => {
    const result = normalizeProductFields(
      { gallery: [8, 12] },
      { currentGallery: [{ image: 12, variantOption: 4 }] },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields.gallery).toEqual([{ image: 8 }, { image: 12, variantOption: 4 }])
  })

  it('reports a readable gallery diff instead of raw JSON', () => {
    const result = normalizeProductFields(
      { gallery: [1, 2] },
      { currentGallery: [{ image: 3 }] },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.diffs).toEqual([{ from: '1 image', label: 'Gallery', to: '2 images' }])
  })

  it('rejects an empty gallery because the collection requires one row', () => {
    const result = normalizeProductFields({ gallery: [] })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual([
      '"gallery" must keep at least one image — a product without a picture is rejected by the collection.',
    ])
  })

  it('rejects non-numeric media ids', () => {
    const result = normalizeProductFields({ gallery: ['nope'] })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toEqual(['"gallery" must contain positive numeric media ids only.'])
  })

  it('deduplicates repeated media ids', () => {
    const result = normalizeProductFields({ gallery: [5, 5, 6] })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields.gallery).toEqual([{ image: 5 }, { image: 6 }])
  })

  it('accepts populated media objects from a previous read', () => {
    const result = normalizeProductFields({ gallery: [{ id: 7 }] as unknown as number[] })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.result.fields.gallery).toEqual([{ image: 7 }])
  })
})
