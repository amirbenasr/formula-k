import { describe, it, expect } from 'vitest'
import { toKebabCase } from '../toKebabCase'

describe('toKebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(toKebabCase('camelCase')).toBe('camel-case')
    expect(toKebabCase('myVariableName')).toBe('my-variable-name')
  })

  it('converts spaces to hyphens', () => {
    expect(toKebabCase('hello world')).toBe('hello-world')
    expect(toKebabCase('Hello World')).toBe('hello-world')
  })

  it('converts multiple spaces to hyphens', () => {
    expect(toKebabCase('hello   world')).toBe('hello-world')
  })

  it('returns already-kebab strings unchanged', () => {
    expect(toKebabCase('already-kebab')).toBe('already-kebab')
  })

  it('handles empty string', () => {
    expect(toKebabCase('')).toBe('')
  })

  it('lowercases all characters', () => {
    expect(toKebabCase('ALLCAPS')).toBe('allcaps')
  })
})
