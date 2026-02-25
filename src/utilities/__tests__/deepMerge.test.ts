import { describe, it, expect } from 'vitest'
import { deepMerge, isObject } from '../deepMerge'

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
  })

  it('returns false for arrays', () => {
    expect(isObject([])).toBe(false)
  })

  it('returns falsy for null', () => {
    expect(isObject(null)).toBeFalsy()
  })

  it('returns falsy for primitives', () => {
    expect(isObject('string')).toBeFalsy()
    expect(isObject(42)).toBeFalsy()
    expect(isObject(undefined)).toBeFalsy()
  })
})

describe('deepMerge', () => {
  it('merges shallow properties', () => {
    const result = deepMerge({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('overrides shallow properties from source', () => {
    const result = deepMerge({ a: 1 }, { a: 2 })
    expect(result).toEqual({ a: 2 })
  })

  it('deeply merges nested objects', () => {
    const target = { nested: { a: 1, b: 2 } }
    const source = { nested: { b: 3, c: 4 } }
    const result = deepMerge(target, source)
    expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 } })
  })

  it('adds new nested keys from source', () => {
    const target = { a: 1 }
    const source = { nested: { b: 2 } }
    const result = deepMerge(target, source)
    expect(result).toEqual({ a: 1, nested: { b: 2 } })
  })

  it('does not mutate the target', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    deepMerge(target, source)
    expect(target).toEqual({ a: 1 })
  })

  it('overwrites arrays from source', () => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3, 4] })
    expect(result).toEqual({ arr: [3, 4] })
  })
})
