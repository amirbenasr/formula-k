'use client'

import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ConversationSummary } from './types'
import { groupConversations, relativeTime } from './utils'

type Props = {
  activeKey: null | string
  conversations: ConversationSummary[]
  error: null | string
  loading: boolean
  onClose: () => void
  onDelete: (key: string) => Promise<void>
  onNew: () => void
  onRename: (key: string, title: string) => Promise<void>
  onSelect: (key: string) => void
  open: boolean
}

export function ConversationSidebar({
  activeKey,
  conversations,
  error,
  loading,
  onClose,
  onDelete,
  onNew,
  onRename,
  onSelect,
  open,
}: Props) {
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<null | string>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<null | string>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      renameRef.current?.focus()
      renameRef.current?.select()
    }
  }, [renaming])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations

    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(needle) ||
        conversation.preview.toLowerCase().includes(needle),
    )
  }, [conversations, query])

  const groups = useMemo(() => groupConversations(filtered), [filtered])

  const startRename = useCallback((conversation: ConversationSummary) => {
    setRenaming(conversation.key)
    setDraft(conversation.title)
  }, [])

  const commitRename = useCallback(async () => {
    if (!renaming || saving) return

    const next = draft.trim()
    const current = conversations.find((conversation) => conversation.key === renaming)

    if (!next || next === current?.title) {
      setRenaming(null)
      return
    }

    setSaving(true)
    try {
      await onRename(renaming, next)
      setRenaming(null)
    } catch {
      // The parent surfaces the error; keep the input open so the text is not lost.
    } finally {
      setSaving(false)
    }
  }, [conversations, draft, onRename, renaming, saving])

  const remove = useCallback(
    async (conversation: ConversationSummary) => {
      if (deleting) return

      const confirmed = window.confirm(
        `Delete “${conversation.title}”? The chat history will be removed. Applied changes are kept in AI activity.`,
      )

      if (!confirmed) return

      setDeleting(conversation.key)
      try {
        await onDelete(conversation.key)
      } finally {
        setDeleting(null)
      }
    },
    [deleting, onDelete],
  )

  return (
    <aside
      aria-label="Conversation history"
      className={['ai-assistant__sidebar', open && 'ai-assistant__sidebar--open']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ai-assistant__sidebar-head">
        <div className="ai-assistant__sidebar-title-row">
          <span className="ai-assistant__sidebar-title">Conversations</span>
          <button
            aria-label="Close conversation history"
            className="ai-assistant__icon-btn ai-assistant__sidebar-close"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <button className="ai-assistant__new-chat" onClick={onNew} type="button">
          <Plus size={16} />
          New chat
        </button>

        <label className="ai-assistant__search">
          <Search aria-hidden className="ai-assistant__search-icon" size={14} />
          <input
            aria-label="Search conversations"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="ai-assistant__conversations">
        {loading && conversations.length === 0 && (
          <p className="ai-assistant__sidebar-hint">Loading your history…</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="ai-assistant__sidebar-empty">
            <MessageSquare size={20} />
            <p>{query ? 'No chats match that search.' : 'Your chats will appear here.'}</p>
            {!query && (
              <p className="ai-assistant__sidebar-hint">
                Start a conversation and it is saved automatically.
              </p>
            )}
          </div>
        )}

        {groups.map((group) => (
          <div className="ai-assistant__group" key={group.label}>
            <p className="ai-assistant__group-label">{group.label}</p>

            {group.items.map((conversation) => {
              const isActive = conversation.key === activeKey
              const isRenaming = renaming === conversation.key

              return (
                <div
                  className={['ai-assistant__conversation', isActive && 'ai-assistant__conversation--active']
                    .filter(Boolean)
                    .join(' ')}
                  key={conversation.key}
                >
                  {isRenaming ? (
                    <div className="ai-assistant__rename">
                      <input
                        aria-label="Conversation title"
                        disabled={saving}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void commitRename()
                          }
                          if (event.key === 'Escape') setRenaming(null)
                        }}
                        ref={renameRef}
                        value={draft}
                      />
                      <button
                        aria-label="Save title"
                        className="ai-assistant__icon-btn"
                        disabled={saving}
                        onClick={() => void commitRename()}
                        type="button"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        aria-label="Cancel rename"
                        className="ai-assistant__icon-btn"
                        disabled={saving}
                        onClick={() => setRenaming(null)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="ai-assistant__conversation-main"
                        onClick={() => onSelect(conversation.key)}
                        type="button"
                      >
                        <span className="ai-assistant__conversation-title">{conversation.title}</span>
                        <span className="ai-assistant__conversation-meta">
                          {relativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                          {conversation.messageCount > 0
                            ? ` · ${conversation.messageCount} message${conversation.messageCount === 1 ? '' : 's'}`
                            : ''}
                        </span>
                        {conversation.preview && (
                          <span className="ai-assistant__conversation-preview">
                            {conversation.preview}
                          </span>
                        )}
                      </button>

                      <div className="ai-assistant__conversation-actions">
                        <button
                          aria-label={`Rename “${conversation.title}”`}
                          className="ai-assistant__icon-btn"
                          onClick={() => startRename(conversation)}
                          type="button"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          aria-label={`Delete “${conversation.title}”`}
                          className="ai-assistant__icon-btn ai-assistant__icon-btn--danger"
                          disabled={deleting === conversation.key}
                          onClick={() => void remove(conversation)}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {error && <p className="ai-assistant__sidebar-error">{error}</p>}
      </div>

      <p className="ai-assistant__sidebar-foot">
        {conversations.length > 0
          ? `${conversations.length} saved chat${conversations.length === 1 ? '' : 's'}`
          : 'History is private to you'}
      </p>
    </aside>
  )
}
