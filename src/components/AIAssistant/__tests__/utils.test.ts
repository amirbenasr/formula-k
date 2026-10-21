import { describe, expect, it } from 'vitest'

import {
  cell,
  displayFirstName,
  greetingFor,
  groupConversations,
  relativeTime,
} from '../utils'

describe('displayFirstName', () => {
  it('takes the first word of a full name', () => {
    expect(displayFirstName('Amir Hammami', 'amir@example.com')).toBe('Amir')
  })

  it('falls back to the email local-part', () => {
    expect(displayFirstName(null, 'sana.benali@example.com')).toBe('Sana')
    expect(displayFirstName('', 'sana_benali@example.com')).toBe('Sana')
  })

  it('has a safe fallback', () => {
    expect(displayFirstName(null, null)).toBe('there')
  })
})

describe('greetingFor', () => {
  it('changes with the time of day', () => {
    expect(greetingFor(new Date(2026, 4, 1, 2))).toBe('Working late')
    expect(greetingFor(new Date(2026, 4, 1, 9))).toBe('Good morning')
    expect(greetingFor(new Date(2026, 4, 1, 14))).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 4, 1, 21))).toBe('Good evening')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-05-01T12:00:00Z')

  it('uses compact units', () => {
    expect(relativeTime(new Date('2026-05-01T11:59:30Z'), now)).toBe('just now')
    expect(relativeTime(new Date('2026-05-01T11:42:00Z'), now)).toBe('18m')
    expect(relativeTime(new Date('2026-05-01T08:00:00Z'), now)).toBe('4h')
    expect(relativeTime(new Date('2026-04-28T12:00:00Z'), now)).toBe('3d')
  })

  it('uses a date once it is older than a week', () => {
    expect(relativeTime(new Date('2026-04-01T12:00:00Z'), now)).toMatch(/\d/)
  })

  it('is empty for missing or invalid values', () => {
    expect(relativeTime(null, now)).toBe('')
    expect(relativeTime(undefined, now)).toBe('')
    expect(relativeTime('not-a-date', now)).toBe('')
  })
})

describe('groupConversations', () => {
  const now = new Date('2026-05-08T12:00:00Z')
  const conversation = (key: string, date: string) => ({
    key,
    lastMessageAt: date,
    messageCount: 1,
    preview: '',
    title: key,
    updatedAt: date,
  })

  it('buckets by age and preserves order', () => {
    const groups = groupConversations(
      [
        conversation('today', '2026-05-08T09:00:00Z'),
        conversation('yesterday', '2026-05-07T09:00:00Z'),
        conversation('week', '2026-05-03T09:00:00Z'),
        conversation('old', '2026-04-01T09:00:00Z'),
      ],
      now,
    )

    expect(groups.map((group) => group.label)).toEqual([
      'Today',
      'Yesterday',
      'Previous 7 days',
      'Older',
    ])
    expect(groups.every((group) => group.items.length === 1)).toBe(true)
  })

  it('drops empty buckets', () => {
    const groups = groupConversations([conversation('today', '2026-05-08T09:00:00Z')], now)

    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
  })
})

describe('cell', () => {
  it('formats primitives and truncates long values', () => {
    expect(cell(null)).toBe('—')
    expect(cell(true)).toBe('yes')
    expect(cell(['a', 'b'])).toBe('a, b')
    expect(cell('x'.repeat(200))).toHaveLength(120)
    expect(cell({ a: 1 })).toBe('{"a":1}')
  })
})
