import { describe, expect, it } from 'vitest'

import {
  generatePreviewPath,
  getPreviewPath,
  isPreviewCollection,
  parsePreviewSearchParams,
} from '../preview'

const params = (query: string) => new URLSearchParams(query)

describe('generatePreviewPath', () => {
  it('returns null when the document has no slug', () => {
    expect(generatePreviewPath({ collection: 'products', slug: undefined })).toBeNull()
    expect(generatePreviewPath({ collection: 'products', slug: null })).toBeNull()
    expect(generatePreviewPath({ collection: 'products', slug: '' })).toBeNull()
    expect(generatePreviewPath({ collection: 'pages', slug: '' })).toBeNull()
  })

  it('links a product to its storefront page', () => {
    const url = generatePreviewPath({ collection: 'products', slug: 'tint-brow' })

    expect(url).toBe('/next/preview?collection=products&path=%2Fproducts%2Ftint-brow&slug=tint-brow')
  })

  it('links a page to the site root', () => {
    const url = generatePreviewPath({ collection: 'pages', slug: 'about' })

    expect(url).toBe('/next/preview?collection=pages&path=%2Fabout&slug=about')
  })

  it('does not embed a shared preview secret', () => {
    const url = generatePreviewPath({ collection: 'products', slug: 'tint-brow' })

    expect(url).not.toContain('previewSecret')
  })

  it('round-trips through parsePreviewSearchParams', () => {
    const url = generatePreviewPath({ collection: 'products', slug: 'tint-brow' }) as string
    const parsed = parsePreviewSearchParams(params(url.split('?')[1] as string))

    expect(parsed).toEqual({
      ok: true,
      preview: {
        collection: 'products',
        path: '/products/tint-brow',
        slug: 'tint-brow',
      },
    })
  })
})

describe('getPreviewPath', () => {
  it('prefixes products and leaves pages at the root', () => {
    expect(getPreviewPath('products', 'x')).toBe('/products/x')
    expect(getPreviewPath('pages', 'x')).toBe('/x')
  })
})

describe('isPreviewCollection', () => {
  it('accepts only the collections that have a storefront route', () => {
    expect(isPreviewCollection('products')).toBe(true)
    expect(isPreviewCollection('pages')).toBe(true)

    // `toString` / `constructor` must not be mistaken for a collection.
    expect(isPreviewCollection('users')).toBe(false)
    expect(isPreviewCollection('toString')).toBe(false)
    expect(isPreviewCollection(null)).toBe(false)
  })
})

describe('parsePreviewSearchParams', () => {
  it('derives the path when it is missing', () => {
    expect(parsePreviewSearchParams(params('collection=products&slug=tint-brow'))).toEqual({
      ok: true,
      preview: { collection: 'products', path: '/products/tint-brow', slug: 'tint-brow' },
    })
  })

  it('accepts a legacy link that repeats the matching path', () => {
    expect(
      parsePreviewSearchParams(params('collection=pages&slug=about&path=%2Fabout')),
    ).toEqual({
      ok: true,
      preview: { collection: 'pages', path: '/about', slug: 'about' },
    })
  })

  it('rejects an unknown collection', () => {
    expect(parsePreviewSearchParams(params('collection=users&slug=admin'))).toEqual({
      message: 'Unknown collection',
      ok: false,
      status: 400,
    })
  })

  it('rejects a missing slug or collection', () => {
    expect(parsePreviewSearchParams(params('collection=products'))).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(parsePreviewSearchParams(params('slug=tint-brow'))).toMatchObject({
      ok: false,
      status: 400,
    })
  })

  it('rejects a path that does not belong to the document', () => {
    for (const path of ['/admin', '/products/other', '//evil.example.com', '/products/../admin']) {
      expect(
        parsePreviewSearchParams(
          params(`collection=products&slug=tint-brow&path=${encodeURIComponent(path)}`),
        ),
      ).toEqual({
        message: 'Preview path does not match the requested document',
        ok: false,
        status: 400,
      })
    }
  })
})
