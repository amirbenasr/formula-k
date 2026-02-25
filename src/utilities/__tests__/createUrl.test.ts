import { describe, it, expect } from 'vitest'
import { createUrl } from '../createUrl'

describe('createUrl', () => {
  it('creates URL with query params', () => {
    const params = new URLSearchParams({ q: 'test', sort: 'price' })
    const result = createUrl('/shop', params)
    expect(result).toBe('/shop?q=test&sort=price')
  })

  it('creates URL without query params when params are empty', () => {
    const params = new URLSearchParams()
    const result = createUrl('/shop', params)
    expect(result).toBe('/shop')
  })

  it('handles single param', () => {
    const params = new URLSearchParams({ category: 'skincare' })
    const result = createUrl('/products', params)
    expect(result).toBe('/products?category=skincare')
  })
})
