'use client'

import { useChat } from '@ai-sdk/react'
import { Button } from '@payloadcms/ui'
import { DefaultChatTransport, type UIMessage } from 'ai'
import {
  AlertCircle,
  ArrowUp,
  BarChart3,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  PackageSearch,
  Paperclip,
  PlusCircle,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Markdown } from './Markdown'
import type {
  ActionMap,
  ApplyResponse,
  ConversationAction,
  ResolvedImage,
  StagedOutput,
  ToolPartShape,
} from './types'
import { cell, errorMessage } from './utils'

/**
 * One live conversation. Remounted (via a React `key`) whenever the sidebar
 * selects a different chat, which is what lets `useChat` take the stored
 * transcript as its initial state instead of syncing it after the fact.
 */
type Props = {
  actions: ActionMap
  conversationKey: string
  initialMessages: UIMessage[]
  onActionApplied: (actionId: string, message: string) => void
  onSaved: () => void
  prompt?: string
  userName: string
}

const ATTACHMENT_NOTE = /\[attached media id=(\d+)[^\]]*\]/i

function displayText(text: string): string {
  return text.replace(ATTACHMENT_NOTE, '').trim()
}

type Attachment = { alt: string; id: number; url?: string }

/** Uploads the file through Payload's media endpoint and hands back its row. */
async function uploadImage(file: File): Promise<Attachment> {
  const alt =
    file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'Product image'

  const body = new FormData()
  body.append('file', file)
  // `alt` is required by the collection, and is also what find_media matches on.
  body.append('alt', alt)

  const response = await fetch('/api/media', {
    body,
    credentials: 'same-origin',
    method: 'POST',
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message || data?.message || `Upload failed (${response.status})`,
    )
  }

  // Payload returns the created document; tolerate a `{ doc }` wrapper too.
  const doc = data?.doc ?? data

  if (!doc?.id) throw new Error('The upload did not return a media id.')

  return { alt: doc.alt ?? alt, id: doc.id, url: doc.url }
}

/** Turns the apply response into a sentence for the admin. */
function appliedSummary(data: ApplyResponse | null): string {
  const writes = data?.appliedWrites ?? []

  if (writes.length > 0) {
    const write = writes[0]
    const verb =
      write.op === 'create'
        ? 'Created'
        : write.op === 'publish'
          ? 'Published'
          : write.op === 'archive'
            ? 'Moved back to draft'
            : 'Updated'

    const status = write.status ? ` (${write.status})` : ''

    return `${verb} ${write.label}${status}.`
  }

  const count = data?.applied?.length ?? 0

  return `Applied ${count} stock change${count === 1 ? '' : 's'}.`
}

const TOOL_LABELS: Record<string, string> = {
  find_brands: 'Brand search',
  find_media: 'Image library search',
  find_products: 'Catalogue search',
  get_inventory: 'Stock lookup',
  inventory_report: 'Stock report',
  list_orders: 'Order lookup',
  list_reward_tiers: 'Reward tiers',
  list_rewards_catalog: 'Rewards catalogue',
  order_stats: 'Order summary',
  search_web_images: 'Web image search',
  stage_brand_create: 'Prepared a new brand',
  stage_brand_update: 'Prepared the brand edit',
  stage_inventory_update: 'Prepared the stock change',
  stage_product_create: 'Prepared a new product',
  stage_product_images: 'Prepared the image change',
  stage_product_publish: 'Prepared the publish change',
  stage_product_update: 'Prepared the product edit',
}

function ApprovalTable({ output }: { output: StagedOutput }) {
  const preview = output.preview
  const rows = preview?.diffs ?? output.changes ?? []
  const creates = preview?.willCreate === true

  return (
    <div className="ai-assistant__table-wrap">
      <table className="ai-assistant__diff">
        <thead>
          <tr>
            <th>Field</th>
            <th>{creates ? 'Value' : 'Now'}</th>
            {!creates && <th>After</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const hasChange = 'to' in row
            const change = row as { from?: unknown; label: string; to?: unknown }

            return (
              <tr key={index}>
                <td>{row.label}</td>
                {creates ? (
                  <td>
                    <strong>{cell(change.to)}</strong>
                  </td>
                ) : (
                  <>
                    <td>{cell(change.from)}</td>
                    {hasChange && (
                      <td>
                        <strong>{cell(change.to)}</strong>
                      </td>
                    )}
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Shows the gallery as the proposal will leave it.
 *
 * Ids alone would be useless for review: the whole point of checking "the store
 * already has this one" is that a human can look at it. The primary image comes
 * first, added images are badged, and web-sourced images carry their licence
 * because those are not official brand assets.
 */
function StagedImages({ images, primary }: { images: ResolvedImage[]; primary?: ResolvedImage }) {
  return (
    <div className="ai-assistant__images">
      {images.map((image) => {
        const isPrimary = primary?.id === image.id
        const badges = [isPrimary ? 'Primary' : null, image.added ? 'New' : null].filter(
          (badge): badge is string => badge !== null,
        )

        const source =
          image.source === 'web' ? 'From the web' : image.source === 'upload' ? 'Uploaded' : ''

        return (
          <figure
            className={['ai-assistant__image', isPrimary && 'ai-assistant__image--primary']
              .filter(Boolean)
              .join(' ')}
            key={image.id}
          >
            {image.url ? (
              // `next/image` is the wrong tool in the admin panel: these URLs
              // point at R2, the local media folder, or an arbitrary remote CDN,
              // none of which are in `images.remotePatterns`, so optimisation
              // would either fail or require configuring every host upfront.
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={image.alt ?? ''} src={image.url} />
            ) : (
              <span className="ai-assistant__image-missing">media #{image.id}</span>
            )}
            <figcaption>
              {badges.length > 0 && <strong>{badges.join(' · ')} </strong>}
              <span>{[source, image.credit].filter(Boolean).join(' · ')}</span>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

type StagedState = 'applied' | 'cancelled' | 'error' | 'idle' | 'saving'

function initialState(stored?: ConversationAction): StagedState {
  if (stored?.status === 'applied') return 'applied'
  if (stored?.status === 'failed') return 'error'
  if (stored?.status === 'cancelled') return 'cancelled'

  return 'idle'
}

function initialMessage(stored?: ConversationAction): null | string {
  if (stored?.status === 'applied') {
    return stored.summary ? `Applied — ${stored.summary}` : 'Applied.'
  }
  if (stored?.status === 'failed') return stored.error ?? 'This change failed to apply.'
  if (stored?.status === 'cancelled') return 'Cancelled.'

  return null
}

/** Renders the diff for a staged change, with the Apply control. */
function StagedAction({
  onApplied,
  output,
  stored,
}: {
  onApplied: (actionId: string, message: string) => void
  output: StagedOutput
  stored?: ConversationAction
}) {
  const [state, setState] = useState<StagedState>(() => initialState(stored))
  const [message, setMessage] = useState<null | string>(() => initialMessage(stored))
  const actionId = output.actionId === undefined ? null : String(output.actionId)

  const apply = useCallback(async () => {
    if (!actionId) return

    setState('saving')
    setMessage(null)

    try {
      const response = await fetch('/api/admin-ai/apply', {
        body: JSON.stringify({ actionId: output.actionId }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.errors?.[0]?.message || data?.message || `Request failed (${response.status})`,
        )
      }

      const summary = appliedSummary(data as ApplyResponse | null)
      setState('applied')
      setMessage(summary)
      onApplied(actionId, summary)
    } catch (error) {
      setState('error')
      setMessage(errorMessage(error, 'Could not apply the change.'))
    }
  }, [actionId, onApplied, output.actionId])

  if (!output.staged) return null

  const creates = output.preview?.willCreate === true
  const title = output.preview?.title ?? output.summary
  const isCatalogue = Boolean(output.preview)

  const heading = creates
    ? `Proposed new ${output.preview?.targetKind ?? 'item'} — needs your approval`
    : 'Proposed change — needs your approval'

  return (
    <div className="ai-assistant__staged">
      <div className="ai-assistant__staged-head">
        <strong>{heading}</strong>
        {title && (
          <span className="ai-assistant__staged-subject">
            {title}
            {output.preview?.op ? ` · ${output.preview.op}` : ''}
          </span>
        )}
      </div>

      <ApprovalTable output={output} />

      {(output.preview?.images ?? []).length > 0 && (
        <StagedImages images={output.preview?.images ?? []} primary={output.preview?.primary} />
      )}

      {(output.problems ?? []).length > 0 && (
        <ul className="ai-assistant__problems">
          {output.problems?.map((problem, index) => (
            <li key={index}>{problem}</li>
          ))}
        </ul>
      )}

      {isCatalogue && creates && (
        <p className="ai-assistant__hint">
          Attach an image here and the assistant can add it to the gallery — or create the product
          first and ask it to set the image afterwards.
        </p>
      )}

      {state === 'applied' && (
        <p className="ai-assistant__applied">
          <CheckCircle2 size={15} /> {message}
        </p>
      )}

      {state === 'cancelled' && <p className="ai-assistant__hint">{message}</p>}

      {state !== 'applied' && state !== 'cancelled' && (
        <div className="ai-assistant__staged-actions">
          <Button
            disabled={state === 'saving' || !actionId}
            onClick={apply}
            size="small"
            type="button"
          >
            {state === 'saving' ? 'Applying…' : 'Apply change'}
          </Button>
          {state === 'error' && <span className="ai-assistant__error">{message}</span>}
        </div>
      )}
    </div>
  )
}

function ToolPart({
  onApplied,
  part,
  stored,
}: {
  onApplied: (actionId: string, message: string) => void
  part: ToolPartShape
  stored?: ConversationAction
}) {
  const name = part.type.replace(/^tool-/, '')
  const output = part.output

  if (output?.staged) return <StagedAction onApplied={onApplied} output={output} stored={stored} />

  const label = TOOL_LABELS[name] ?? name.replace(/_/g, ' ')
  const failed = part.state === 'output-error' || Boolean(part.errorText)
  const done =
    part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied'

  return (
    <div
      className={['ai-assistant__tool', failed && 'ai-assistant__tool--failed']
        .filter(Boolean)
        .join(' ')}
    >
      {failed ? (
        <AlertCircle size={13} />
      ) : done ? (
        <Check size={13} className="ai-assistant__tool-check" />
      ) : (
        <Loader2 className="ai-assistant__spin" size={13} />
      )}
      <span>{failed ? `Could not finish: ${label}` : label}</span>
      <code>{name}</code>
      {failed && part.errorText && <span className="ai-assistant__tool-error">{part.errorText}</span>}
    </div>
  )
}

const SUGGESTIONS = [
  {
    hint: 'Low-stock report across the catalogue',
    icon: PackageSearch,
    prompt: 'What is running low on stock?',
    title: 'Check stock',
  },
  {
    hint: 'Create a product and attach its photo',
    icon: PlusCircle,
    prompt: 'I want to add a new product',
    title: 'Add a product',
  },
  {
    hint: 'Find the right picture for a product',
    icon: ImageIcon,
    prompt: 'Set the main image for a product',
    title: 'Fix product images',
  },
  {
    hint: 'Orders and revenue at a glance',
    icon: BarChart3,
    prompt: 'How many orders came in this month?',
    title: 'This month’s orders',
  },
]

export function ChatSession({
  actions,
  conversationKey,
  initialMessages,
  onActionApplied,
  onSaved,
  prompt,
  userName,
}: Props) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<null | string>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const sentPrompt = useRef(false)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/admin-ai/chat',
        body: { conversationId: conversationKey },
      }),
    [conversationKey],
  )

  const { error, messages, regenerate, sendMessage, status, stop } = useChat({
    id: conversationKey,
    messages: initialMessages,
    onFinish: () => {
      // The server persists in the stream's onEnd, which can land a moment after
      // the client sees `finish`. Refresh twice so a brand-new chat's title shows
      // up without making the admin reload.
      onSaved()
      window.setTimeout(onSaved, 900)
    },
    transport,
  })

  const busy = status === 'submitted' || status === 'streaming'

  const submit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault()

      if (busy || uploading) return

      const text = input.trim()
      if (!text && !attachment) return

      // The model gets a real media id, never the file: DeepSeek is text-only.
      const note = attachment
        ? `\n\n[attached media id=${attachment.id} alt="${attachment.alt}"]${
            attachment.url ? ` url=${attachment.url}` : ''
          }`
        : ''

      const body = text || 'Attach the image I just uploaded to the right product.'

      void sendMessage({ text: `${body}${note}` })

      setInput('')
      setAttachment(null)
      stickToBottom.current = true
      requestAnimationFrame(() => textareaRef.current?.focus())
    },
    [attachment, busy, input, sendMessage, uploading],
  )

  const pickFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset first, so choosing the same file twice still fires a change event.
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      setAttachment(await uploadImage(file))
    } catch (uploadFailure) {
      setUploadError(errorMessage(uploadFailure, 'Could not upload the image.'))
    } finally {
      setUploading(false)
    }
  }, [])

  // A prompt handed over by the dashboard greeting is sent once, on mount.
  //
  // The setTimeout is deliberate: React StrictMode mounts, cleans up and remounts
  // effects in development, and `useChat`'s cleanup aborts any request that is
  // already in flight. Sending on a timer means the cancelled first pass never
  // starts the request, so the second (live) pass does — instead of the message
  // being aborted and silently lost.
  useEffect(() => {
    if (!prompt || sentPrompt.current) return

    const timer = window.setTimeout(() => {
      if (sentPrompt.current) return

      sentPrompt.current = true
      void sendMessage({ text: prompt })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [prompt, sendMessage])

  // Start a reopened conversation at the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9 })
  }, [])

  // Follow the stream only while the admin is already at the bottom; scrolling
  // up to read an earlier proposal should not be yanked away by a new token.
  useEffect(() => {
    if (!stickToBottom.current) return

    scrollRef.current?.scrollTo({ behavior: 'smooth', top: scrollRef.current.scrollHeight })
  }, [messages, status])

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`
  }, [input])

  const lastMessage = messages[messages.length - 1]
  const lastHasText =
    lastMessage?.parts.some((part) => part.type === 'text' && part.text.trim().length > 0) ?? false
  const showThinking =
    busy && (!lastMessage || lastMessage.role === 'user' || !lastHasText)

  const sendSuggestion = useCallback(
    (suggestion: string) => {
      if (busy) return
      stickToBottom.current = true
      void sendMessage({ text: suggestion })
    },
    [busy, sendMessage],
  )

  return (
    <div className="ai-assistant__chat">
      <div
        className="ai-assistant__scroll"
        onScroll={(event) => {
          const element = event.currentTarget
          stickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 90
        }}
        ref={scrollRef}
      >
        <div className="ai-assistant__messages">
          {messages.length === 0 && (
            <div className="ai-assistant__welcome">
              <div className="ai-assistant__welcome-mark">
                <Sparkles size={22} />
              </div>
              <h2>How can I help you, {userName}?</h2>
              <p>
                Ask about stock, products, orders or the loyalty programme. I can also prepare
                changes — nothing is saved until you press <strong>Apply</strong>.
              </p>

              <div className="ai-assistant__suggestions">
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon

                  return (
                    <button
                      className="ai-assistant__suggestion"
                      key={suggestion.title}
                      onClick={() => sendSuggestion(suggestion.prompt)}
                      type="button"
                    >
                      <span className="ai-assistant__suggestion-icon">
                        <Icon size={16} />
                      </span>
                      <span>
                        <strong>{suggestion.title}</strong>
                        <span>{suggestion.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {messages.map((message) => {
            if (message.role === 'user') {
              const text = message.parts
                .filter((part): part is { text: string; type: 'text' } => part.type === 'text')
                .map((part) => displayText(part.text))
                .filter(Boolean)
                .join('\n')

              if (!text) return null

              return (
                <div className="ai-assistant__message ai-assistant__message--user" key={message.id}>
                  <div className="ai-assistant__bubble">{text}</div>
                </div>
              )
            }

            if (message.role !== 'assistant') return null

            return (
              <div className="ai-assistant__message ai-assistant__message--assistant" key={message.id}>
                <div className="ai-assistant__avatar" aria-hidden>
                  <Sparkles size={14} />
                </div>
                <div className="ai-assistant__body">
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      const text = displayText(part.text)
                      if (!text) return null

                      return <Markdown key={index}>{text}</Markdown>
                    }

                    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                      const toolPart = part as ToolPartShape
                      const stored =
                        toolPart.output?.actionId !== undefined
                          ? actions[String(toolPart.output.actionId)]
                          : undefined

                      return (
                        <ToolPart
                          key={index}
                          onApplied={onActionApplied}
                          part={toolPart}
                          stored={stored}
                        />
                      )
                    }

                    return null
                  })}
                </div>
              </div>
            )
          })}

          {showThinking && (
            <div className="ai-assistant__message ai-assistant__message--assistant">
              <div className="ai-assistant__avatar" aria-hidden>
                <Sparkles size={14} />
              </div>
              <div className="ai-assistant__thinking">
                <span />
                <span />
                <span />
                <em>Thinking…</em>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ai-assistant__composer">
        <div className="ai-assistant__composer-inner">
          {error && (
            <div className="ai-assistant__error-banner" role="alert">
              <AlertCircle size={15} />
              <span>{errorMessage(error, 'The assistant could not answer.')}</span>
              <button onClick={() => void regenerate()} type="button">
                Try again
              </button>
            </div>
          )}

          {(attachment || uploadError) && (
            <div className="ai-assistant__attachments">
              {attachment && (
                <span className="ai-assistant__attachment">
                  {attachment.url && (
                    // Same reason as the proposal thumbnails: an arbitrary media URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={attachment.alt} src={attachment.url} />
                  )}
                  <span className="ai-assistant__attachment-name">{attachment.alt}</span>
                  <button
                    aria-label="Remove attachment"
                    className="ai-assistant__attachment-remove"
                    onClick={() => setAttachment(null)}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </span>
              )}
              {uploadError && <span className="ai-assistant__error">{uploadError}</span>}
            </div>
          )}

          <form className="ai-assistant__composer-box" onSubmit={submit}>
            <button
              aria-label="Attach an image"
              className="ai-assistant__attach"
              disabled={busy || uploading}
              onClick={() => fileRef.current?.click()}
              title={attachment ? 'Replace image' : 'Attach an image'}
              type="button"
            >
              {uploading ? <Loader2 className="ai-assistant__spin" size={16} /> : <Paperclip size={16} />}
            </button>

            <input accept="image/*" hidden onChange={pickFile} ref={fileRef} type="file" />

            <textarea
              aria-label="Message the assistant"
              className="ai-assistant__input"
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
              onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask anything about your store…"
              ref={textareaRef}
              rows={1}
              value={input}
            />

            {busy ? (
              <button
                aria-label="Stop the response"
                className="ai-assistant__send ai-assistant__send--stop"
                onClick={stop}
                title="Stop"
                type="button"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                aria-label="Send message"
                className="ai-assistant__send"
                disabled={uploading || (input.trim().length === 0 && !attachment)}
                title="Send"
                type="submit"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </form>

          <p className="ai-assistant__composer-hint">
            <span>Enter to send · Shift + Enter for a new line</span>
            <span>Changes need your approval before they go live.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
