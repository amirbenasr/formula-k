import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  deriveConversationPreview,
  deriveConversationTitle,
  isConversationKey,
  relationshipId,
  stripAttachmentNotes,
} from '../conversation-text'

function message(role: UIMessage['role'], text?: string): UIMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2)}`,
    parts: text ? [{ text, type: 'text' }] : [],
    role,
  }
}

describe('deriveConversationTitle', () => {
  it('uses the first user message, not the assistant reply', () => {
    const title = deriveConversationTitle([
      message('assistant', 'How can I help?'),
      message('user', 'What is running low on stock?'),
    ])

    expect(title).toBe('What is running low on stock?')
  })

  it('uses the first sentence of a long prompt', () => {
    const title = deriveConversationTitle([
      message('user', 'Add a new product. It is the Anua toner, 250ml, priced at 39 TND.'),
    ])

    expect(title).toBe('Add a new product.')
  })

  it('cuts an unpunctuated prompt at a word boundary', () => {
    const title = deriveConversationTitle([
      message(
        'user',
        'Create a product called Anua Heartleaf 77 percent Soothing Toner for sensitive skin with a price of thirty nine dinars',
      ),
    ])

    expect(title.length).toBeLessThanOrEqual(71)
    expect(title.endsWith('…')).toBe(true)
    expect(title).not.toMatch(/\s…$/)
  })

  it('hides the attachment marker from the title', () => {
    const title = deriveConversationTitle([
      message('user', 'Attach this image to the Anua toner\n\n[attached media id=42 alt="serum"]'),
    ])

    expect(title).toBe('Attach this image to the Anua toner')
  })

  it('falls back for an attachment-only conversation', () => {
    expect(deriveConversationTitle([message('user')])).toBe('Image attachment')
  })

  it('falls back when there is no user message yet', () => {
    expect(deriveConversationTitle([])).toBe('New conversation')
  })
})

describe('deriveConversationPreview', () => {
  it('prefers the most recent message', () => {
    expect(
      deriveConversationPreview([
        message('user', 'What is low?'),
        message('assistant', 'Three products are below five units.'),
      ]),
    ).toBe('Three products are below five units.')
  })

  it('skips tool-only messages', () => {
    expect(
      deriveConversationPreview([message('user', 'Check stock'), message('assistant')]),
    ).toBe('Check stock')
  })

  it('collapses whitespace and strips attachment notes', () => {
    expect(
      deriveConversationPreview([
        message('user', '  hello\n\n[attached media id=7 alt="x"]   world  '),
      ]),
    ).toBe('hello world')
  })
})

describe('stripAttachmentNotes', () => {
  it('removes a note without leaving a double space', () => {
    expect(stripAttachmentNotes('Set the image [attached media id=9 alt="a b"] now')).toBe(
      'Set the image now',
    )
  })
})

describe('isConversationKey', () => {
  it('accepts a UUID', () => {
    expect(isConversationKey('3f1c2b4e-8a9d-4f6e-9c1a-2b3c4d5e6f70')).toBe(true)
  })

  it('rejects short, empty and unsafe keys', () => {
    expect(isConversationKey('short')).toBe(false)
    expect(isConversationKey('')).toBe(false)
    expect(isConversationKey('../../etc/passwd')).toBe(false)
    expect(isConversationKey(42)).toBe(false)
  })
})

describe('relationshipId', () => {
  it('reads ids from numbers, strings and populated docs', () => {
    expect(relationshipId(7)).toBe(7)
    expect(relationshipId('7')).toBe('7')
    expect(relationshipId({ id: 12 })).toBe(12)
  })

  it('returns null for a missing relationship', () => {
    expect(relationshipId(null)).toBeNull()
    expect(relationshipId(undefined)).toBeNull()
    expect(relationshipId({ name: 'no id' })).toBeNull()
  })
})
