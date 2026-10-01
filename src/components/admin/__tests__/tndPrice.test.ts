import { describe, expect, it } from 'vitest'

import { parseAmount, roundAmount, toAmount, toDisplay } from '../tndPrice'

describe('parseAmount', () => {
  it('reads plain, decimal and comma-separated amounts', () => {
    expect(parseAmount('189')).toBe(189)
    expect(parseAmount('49.9')).toBe(49.9)
    expect(parseAmount('49,9')).toBe(49.9)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount(' 40 ')).toBe(40)
  })

  it('treats empty and malformed input as "no price"', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('  ')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
  })
})

describe('toDisplay', () => {
  it('prints the stored amount unchanged', () => {
    expect(toDisplay(189)).toBe('189')
    expect(toDisplay(49.9)).toBe('49.9')
    expect(toDisplay(0)).toBe('0')
  })

  it('prints nothing for missing values', () => {
    expect(toDisplay(null)).toBe('')
    expect(toDisplay(undefined)).toBe('')
    expect(toDisplay('189')).toBe('')
  })
})

describe('toAmount', () => {
  it('only accepts finite numbers', () => {
    expect(toAmount(49.9)).toBe(49.9)
    expect(toAmount(Number.NaN)).toBeNull()
    expect(toAmount('49.9')).toBeNull()
    expect(toAmount(null)).toBeNull()
  })
})

describe('roundAmount', () => {
  it('keeps millimes and drops float noise', () => {
    expect(roundAmount(49.9)).toBe(49.9)
    expect(roundAmount(49.9004)).toBe(49.9)
    expect(roundAmount(0.1 + 0.2)).toBe(0.3)
  })
})
