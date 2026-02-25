import { describe, it, expect } from 'vitest'
import { formatDateTime } from '../formatDateTime'

describe('formatDateTime', () => {
  it('formats a date with default format (dd/MM/yyyy)', () => {
    const result = formatDateTime({ date: '2024-06-15T12:00:00Z' })
    expect(result).toBe('15/06/2024')
  })

  it('formats a date with a custom format', () => {
    const result = formatDateTime({ date: '2024-06-15T12:00:00Z', format: 'yyyy-MM-dd' })
    expect(result).toBe('2024-06-15')
  })

  it('returns empty string for empty date', () => {
    const result = formatDateTime({ date: '' })
    expect(result).toBe('')
  })
})
