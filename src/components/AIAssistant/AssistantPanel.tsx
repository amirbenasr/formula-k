'use client'

import { Loader2, Menu, Plus, Sparkles, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChatSession } from './ChatSession'
import { ConversationSidebar } from './ConversationSidebar'
import type { ActionMap, ConversationAction, ConversationSummary, LoadedConversation } from './types'
import { actionMapFromList, errorMessage } from './utils'

type ActiveChat = {
  actions: ActionMap
  key: string
  messages: LoadedConversation['messages']
  prompt?: string
  title: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message || data?.message || `Request failed (${response.status})`,
    )
  }

  return data as T
}

/** UUIDs are fine; the fallback keeps older Safari happy and matches the server rule. */
function createConversationKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function setUrlConversation(key?: string) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('prompt')

  if (key) url.searchParams.set('c', key)
  else url.searchParams.delete('c')

  window.history.replaceState({}, '', url.toString())
}

/**
 * Two-pane assistant: saved conversations on the left, the live chat on the
 * right. Selecting a conversation remounts `ChatSession` with that transcript,
 * which is simpler and less error-prone than trying to reconcile a `useChat`
 * instance in place.
 */
export function AssistantPanel({ userName }: { userName: string }) {
  const [active, setActive] = useState<ActiveChat | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [listError, setListError] = useState<null | string>(null)
  const [listLoading, setListLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [notice, setNotice] = useState<null | string>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const started = useRef(false)

  const refreshList = useCallback(async () => {
    setListLoading(true)

    try {
      const data = await request<{ conversations: ConversationSummary[] }>(
        '/api/admin-ai/conversations?limit=100',
      )
      setConversations(data.conversations ?? [])
      setListError(null)
    } catch (error) {
      setListError(errorMessage(error, 'Could not load your conversation history.'))
    } finally {
      setListLoading(false)
    }
  }, [])

  const startNewChat = useCallback((prompt?: string) => {
    setActive({
      actions: {},
      key: createConversationKey(),
      messages: [],
      prompt,
      title: 'New conversation',
    })
    setChatLoading(false)
    setNotice(null)
    setSidebarOpen(false)
    setUrlConversation()
  }, [])

  const openConversation = useCallback(
    async (key: string) => {
      setChatLoading(true)
      setNotice(null)

      try {
        const data = await request<LoadedConversation>(
          `/api/admin-ai/conversations/${encodeURIComponent(key)}`,
        )

        setActive({
          actions: actionMapFromList(data.actions ?? []),
          key,
          messages: data.messages ?? [],
          title: data.summary?.title ?? 'Conversation',
        })
        setSidebarOpen(false)
        setUrlConversation(key)
      } catch (error) {
        setNotice(errorMessage(error, 'Could not open that conversation.'))
        // The row may have been deleted in another tab; resync the list and make
        // sure the pane is never left blank.
        setActive(
          (current) =>
            current ?? {
              actions: {},
              key: createConversationKey(),
              messages: [],
              title: 'New conversation',
            },
        )
        void refreshList()
      } finally {
        setChatLoading(false)
      }
    },
    [refreshList],
  )

  // Read the intent from the URL once: the dashboard greeting links here with a
  // `prompt`, and a conversation link carries `c`.
  useEffect(() => {
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const key = params.get('c')
    const prompt = params.get('prompt')?.trim() || undefined

    void refreshList()

    if (key) {
      if (prompt) setUrlConversation(key)
      void openConversation(key)
    } else {
      startNewChat(prompt)
    }
  }, [openConversation, refreshList, startNewChat])

  // Keep the topbar title in step with a rename, and with the server-generated
  // title that appears after the first message of a new chat. Once the row is
  // persisted, put its key in the URL so a refresh reopens the same chat.
  useEffect(() => {
    if (!active) return

    const summary = conversations.find((conversation) => conversation.key === active.key)
    if (!summary) return

    if (summary.title && summary.title !== active.title) {
      setActive((current) => (current ? { ...current, title: summary.title } : current))
    }

    const inUrl = new URLSearchParams(window.location.search).get('c')
    if (inUrl !== active.key) setUrlConversation(active.key)
  }, [active, conversations])

  const selectConversation = useCallback(
    (key: string) => {
      if (key === active?.key) {
        setSidebarOpen(false)
        return
      }

      void openConversation(key)
    },
    [active?.key, openConversation],
  )

  useEffect(() => {
    if (!sidebarOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  const handleDelete = useCallback(
    async (key: string) => {
      try {
        await request(`/api/admin-ai/conversations/${encodeURIComponent(key)}`, {
          method: 'DELETE',
        })

        setConversations((current) => current.filter((conversation) => conversation.key !== key))

        if (active?.key === key) startNewChat()
      } catch (error) {
        setNotice(errorMessage(error, 'Could not delete that conversation.'))
      }
    },
    [active?.key, startNewChat],
  )

  const handleRename = useCallback(async (key: string, title: string) => {
    try {
      const data = await request<{ conversation: ConversationSummary }>(
        `/api/admin-ai/conversations/${encodeURIComponent(key)}`,
        { body: JSON.stringify({ title }), method: 'PATCH' },
      )

      setConversations((current) =>
        current.map((conversation) =>
          conversation.key === key ? { ...conversation, ...data.conversation } : conversation,
        ),
      )
      setActive((current) =>
        current && current.key === key ? { ...current, title: data.conversation.title } : current,
      )
    } catch (error) {
      setNotice(errorMessage(error, 'Could not rename that conversation.'))
      throw error
    }
  }, [])

  const handleActionApplied = useCallback((actionId: string, message: string) => {
    const applied: ConversationAction = {
      actionId,
      appliedAt: new Date().toISOString(),
      error: null,
      status: 'applied',
      summary: message,
    }

    setActive((current) =>
      current
        ? { ...current, actions: { ...current.actions, [actionId]: applied } }
        : current,
    )
  }, [])

  const sidebar = useMemo(
    () => (
      <ConversationSidebar
        activeKey={active?.key ?? null}
        conversations={conversations}
        error={listError}
        loading={listLoading}
        onClose={() => setSidebarOpen(false)}
        onDelete={handleDelete}
        onNew={() => startNewChat()}
        onRename={handleRename}
        onSelect={selectConversation}
        open={sidebarOpen}
      />
    ),
    [
      active?.key,
      conversations,
      handleDelete,
      handleRename,
      listError,
      listLoading,
      selectConversation,
      sidebarOpen,
      startNewChat,
    ],
  )

  return (
    <div className="ai-assistant">
      <header className="ai-assistant__page-head">
        <div>
          <p className="ai-assistant__eyebrow">
            <Sparkles size={13} /> Formula K assistant
          </p>
          <h1>AI Assistant</h1>
          <p className="ai-assistant__subtitle">
            Ask about stock, products, brands, orders or rewards. Changes are prepared for you and
            only applied when you press Apply.
          </p>
        </div>
      </header>

      {notice && (
        <div className="ai-assistant__notice" role="alert">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice(null)} type="button">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="ai-assistant__workspace">
        {sidebar}

        {sidebarOpen && (
          <button
            aria-label="Close conversation history"
            className="ai-assistant__overlay"
            onClick={() => setSidebarOpen(false)}
            type="button"
          />
        )}

        <main className="ai-assistant__main">
          <div className="ai-assistant__topbar">
            <button
              aria-label="Open conversation history"
              className="ai-assistant__icon-btn ai-assistant__topbar-menu"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu size={18} />
            </button>

            <div className="ai-assistant__topbar-title">
              <span className="ai-assistant__status-dot" />
              <span>{active?.title ?? 'New conversation'}</span>
            </div>

            <button
              aria-label="Start a new chat"
              className="ai-assistant__icon-btn"
              onClick={() => startNewChat()}
              title="New chat"
              type="button"
            >
              <Plus size={18} />
            </button>
          </div>

          {chatLoading || !active ? (
            <div className="ai-assistant__chat-loading">
              <Loader2 className="ai-assistant__spin" size={20} />
              <span>Opening conversation…</span>
            </div>
          ) : (
            <ChatSession
              actions={active.actions}
              conversationKey={active.key}
              initialMessages={active.messages}
              key={active.key}
              onActionApplied={handleActionApplied}
              onSaved={() => void refreshList()}
              prompt={active.prompt}
              userName={userName}
            />
          )}
        </main>
      </div>
    </div>
  )
}
