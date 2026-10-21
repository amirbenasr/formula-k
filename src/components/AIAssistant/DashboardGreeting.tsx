'use client'

import { useAuth } from '@payloadcms/ui'
import { ArrowRight, ArrowUp, Clock, MessageSquare, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

import type { ConversationSummary } from './types'
import { displayFirstName, greetingFor, relativeTime } from './utils'
import './index.scss'

const PROMPTS = [
  'What is running low on stock?',
  'Add a new product',
  'Set the main image for a product',
  'How many orders came in this month?',
]

/**
 * The dashboard's front door to the assistant.
 *
 * It is intentionally not a chat box: the real conversation lives at /admin/ai,
 * with history, attachments and approval cards. This card answers "how do I
 * start?", carries the question into the assistant, and lists recent chats so a
 * returning admin can pick up where they left off.
 */
export function DashboardGreeting() {
  const { user } = useAuth()
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [recent, setRecent] = useState<ConversationSummary[]>([])
  const [greeting, setGreeting] = useState('Welcome back')

  const isAdmin = Boolean(user?.roles?.includes('admin'))
  const firstName = displayFirstName(user?.name, user?.email)

  useEffect(() => {
    setGreeting(greetingFor())
  }, [])

  useEffect(() => {
    if (!isAdmin) return

    let cancelled = false

    fetch('/api/admin-ai/conversations?limit=4', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { conversations?: ConversationSummary[] } | null) => {
        if (!cancelled) setRecent(data?.conversations ?? [])
      })
      .catch(() => {
        // The dashboard is not the place for a failed-history banner; the
        // assistant shows the same error with a retry path.
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const go = useCallback(
    (text: string) => {
      const value = text.trim()

      router.push(value ? `/admin/ai?prompt=${encodeURIComponent(value)}` : '/admin/ai')
    },
    [router],
  )

  if (!isAdmin) return null

  return (
    <section aria-labelledby="dashboard-assistant-title" className="dashboard-ai">
      <div className="dashboard-ai__card">
        <p className="dashboard-ai__eyebrow">
          <Sparkles size={13} />
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </p>

        <h1 className="dashboard-ai__title" id="dashboard-assistant-title">
          How can I help you today?
        </h1>
        <p className="dashboard-ai__lede">
          Ask about stock, products, orders or rewards — or describe a change and I&apos;ll prepare
          it for you. Nothing goes live until you press Apply.
        </p>

        <form
          className="dashboard-ai__form"
          onSubmit={(event) => {
            event.preventDefault()
            go(prompt)
          }}
        >
          <Sparkles aria-hidden className="dashboard-ai__form-icon" size={16} />
          <input
            aria-label="Ask the assistant"
            className="dashboard-ai__input"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask anything about your store…"
            type="text"
            value={prompt}
          />
          <button
            aria-label="Ask the assistant"
            className="dashboard-ai__submit"
            disabled={prompt.trim().length === 0}
            type="submit"
          >
            <ArrowUp size={18} />
          </button>
        </form>

        <div className="dashboard-ai__chips">
          {PROMPTS.map((suggestion) => (
            <button
              className="dashboard-ai__chip"
              key={suggestion}
              onClick={() => go(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="dashboard-ai__recent">
            <span className="dashboard-ai__recent-label">
              <Clock size={13} /> Pick up where you left off
            </span>
            <div className="dashboard-ai__recent-list">
              {recent.map((conversation) => (
                <Link
                  className="dashboard-ai__recent-link"
                  href={`/admin/ai?c=${encodeURIComponent(conversation.key)}`}
                  key={conversation.key}
                >
                  <MessageSquare size={13} />
                  <span>{conversation.title}</span>
                  <em>{relativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}</em>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link className="dashboard-ai__open" href="/admin/ai">
          Open the assistant
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  )
}
