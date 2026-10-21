'use client'

import { useChat } from '@ai-sdk/react'
import { Button } from '@payloadcms/ui'
import { DefaultChatTransport } from 'ai'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import './index.scss'

const baseClass = 'ai-assistant'

/** One row-level stock change, as returned by stage_inventory_update. */
type StockChange = { from: number; label: string; to: number }

/** One resolved image, as returned by stage_product_images. */
type ResolvedImage = {
  added?: boolean
  alt?: string
  credit?: string
  id: number
  source?: string
  sourceUrl?: string
  url?: string
}

/**
 * What the assistant returns for a catalogue operation. The model never renders
 * this: the tool returns the already-validated diff and the panel displays it,
 * so the admin reviews the same values applyAction will write.
 */
type CataloguePreview = {
  diffs?: Array<{ from?: unknown; label: string; to?: unknown }>
  images?: ResolvedImage[]
  mode?: string
  op?: string
  primary?: ResolvedImage
  status?: 'draft' | 'published'
  targetKind?: string
  title?: string
  willCreate?: boolean
}

type StagedOutput = {
  actionId?: number | string
  changes?: StockChange[]
  kind?: string
  preview?: CataloguePreview
  problems?: string[]
  staged?: boolean
  summary?: string
}

type ApplyResponse = {
  applied?: StockChange[]
  appliedWrites?: Array<{ id?: number | string; label: string; op: string; status?: string }>
}

const SUGGESTIONS = [
  'What is running low on stock?',
  'Add a new product',
  'Set the main image for a product',
  'Publish a draft product',
  'How many orders came in this month?',
]

/**
 * The note appended to a message once a file has been uploaded.
 *
 * The assistant cannot receive image bytes — the model is text-only — so the
 * upload happens here, over Payload's own media endpoint, and the model is handed
 * the resulting id. The `[attached media …]` marker is how it learns which image
 * "this one" refers to. It stays in the stored message (the model needs it) and
 * is stripped from the rendered bubble by `displayText`.
 */
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

/** Trims a value to something a table cell can hold. */
function cell(value: unknown, max = 120): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ')

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)

  return text.length > max ? `${text.slice(0, max - 1)}…` : text
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

function ApprovalTable({ output }: { output: StagedOutput }) {
  const preview = output.preview
  const rows = preview?.diffs ?? output.changes ?? []
  const creates = preview?.willCreate === true

  return (
    <table className={`${baseClass}__diff`}>
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
    <div className={`${baseClass}__images`}>
      {images.map((image) => {
        const isPrimary = primary?.id === image.id
        const badges = [isPrimary ? 'Primary' : null, image.added ? 'New' : null].filter(
          (badge): badge is string => badge !== null,
        )

        const source =
          image.source === 'web' ? 'From the web' : image.source === 'upload' ? 'Uploaded' : ''

        return (
          <figure
            className={`${baseClass}__image${isPrimary ? ` ${baseClass}__image--primary` : ''}`}
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
              <span className={`${baseClass}__image-missing`}>media #{image.id}</span>
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

/** Renders the diff for a staged change, with the Apply control. */
function StagedAction({ output }: { output: StagedOutput }) {
  const [state, setState] = useState<'applied' | 'error' | 'idle' | 'saving'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const apply = useCallback(async () => {
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

      setState('applied')
      setMessage(appliedSummary(data as ApplyResponse | null))
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Could not apply the change.')
    }
  }, [output.actionId])

  if (!output.staged) return null

  const creates = output.preview?.willCreate === true
  const isCatalogue = Boolean(output.preview)
  const title = output.preview?.title

  const heading = creates
    ? `Proposed new ${output.preview?.targetKind ?? 'item'} — needs your approval`
    : 'Proposed change — needs your approval'

  return (
    <div className={`${baseClass}__staged`}>
      <div className={`${baseClass}__staged-head`}>
        <strong>{heading}</strong>
        {isCatalogue && title && (
          <span className={`${baseClass}__staged-subject`}>
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
        <ul className={`${baseClass}__problems`}>
          {output.problems?.map((problem, index) => (
            <li key={index}>{problem}</li>
          ))}
        </ul>
      )}

      {isCatalogue && creates && (
        <p className={`${baseClass}__hint`}>
          Attach an image here and the assistant can add it to the gallery — or create the product
          first and ask it to set the image afterwards.
        </p>
      )}

      {state === 'applied' ? (
        <p className={`${baseClass}__applied`}>✓ {message}</p>
      ) : (
        <div className={`${baseClass}__staged-actions`}>
          <Button
            disabled={state === 'saving' || output.actionId === undefined}
            onClick={apply}
            size="small"
          >
            {state === 'saving' ? 'Applying…' : 'Apply change'}
          </Button>
          {state === 'error' && <span className={`${baseClass}__error`}>{message}</span>}
        </div>
      )}
    </div>
  )
}

type ToolPartShape = {
  output?: StagedOutput
  state?: string
  type: string
}

function ToolPart({ part }: { part: ToolPartShape }) {
  const name = part.type.replace(/^tool-/, '')
  const output = part.output

  if (output?.staged) return <StagedAction output={output} />

  const label =
    part.state === 'output-available'
      ? 'Ran'
      : part.state === 'input-available'
        ? 'Running'
        : 'Preparing'

  return (
    <div className={`${baseClass}__tool`}>
      <span className={`${baseClass}__tool-dot`} />
      {label} <code>{name}</code>
    </div>
  )
}

export function Chat() {
  const conversationId = useMemo(() => crypto.randomUUID(), [])
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/admin-ai/chat',
        body: { conversationId },
      }),
    [conversationId],
  )

  const { error, messages, sendMessage, status } = useChat({ transport })

  const busy = status === 'submitted' || status === 'streaming'

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
      setUploadError(
        uploadFailure instanceof Error ? uploadFailure.message : 'Could not upload the image.',
      )
    } finally {
      setUploading(false)
    }
  }, [])

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
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9 }))
    },
    [attachment, busy, input, sendMessage, uploading],
  )

  return (
    <div className={baseClass}>
      <header className={`${baseClass}__header`}>
        <h1>AI Assistant</h1>
        <p className={`${baseClass}__subtitle`}>
          Ask about stock, products, brands, orders or rewards. Changes are prepared for you and
          only applied when you click Apply.
        </p>
      </header>

      <div className={`${baseClass}__list`} ref={listRef}>
        {messages.length === 0 && (
          <div className={`${baseClass}__empty`}>
            {SUGGESTIONS.map((suggestion) => (
              <button
                className={`${baseClass}__suggestion`}
                key={suggestion}
                onClick={() => void sendMessage({ text: suggestion })}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <div
            className={`${baseClass}__message ${baseClass}__message--${message.role}`}
            key={message.id}
          >
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <div className={`${baseClass}__text`} key={index}>
                    {displayText(part.text)}
                  </div>
                )
              }

              if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                return <ToolPart key={index} part={part as ToolPartShape} />
              }

              return null
            })}
          </div>
        ))}

        {busy && <div className={`${baseClass}__pending`}>Thinking…</div>}
      </div>

      {error && <div className={`${baseClass}__error`}>{error.message}</div>}

      <form className={`${baseClass}__form`} onSubmit={submit}>
        <div className={`${baseClass}__tools`}>
          <button
            className={`${baseClass}__attach`}
            disabled={busy || uploading}
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            {uploading ? 'Uploading…' : attachment ? 'Replace image' : 'Attach image'}
          </button>

          <input
            accept="image/*"
            hidden
            onChange={pickFile}
            ref={fileRef}
            type="file"
          />

          {attachment && (
            <span className={`${baseClass}__attachment`}>
              {/* Same reason as the proposal thumbnails: an arbitrary media URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {attachment.url && <img alt={attachment.alt} src={attachment.url} />}
              <span className={`${baseClass}__attachment-name`}>{attachment.alt}</span>
              <button
                aria-label="Remove attachment"
                className={`${baseClass}__attachment-remove`}
                onClick={() => setAttachment(null)}
                type="button"
              >
                ×
              </button>
            </span>
          )}

          {uploadError && <span className={`${baseClass}__error`}>{uploadError}</span>}
        </div>

        <div className={`${baseClass}__row`}>
          <textarea
            className={`${baseClass}__input`}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
            onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Ask about stock, orders, products or images…"
            rows={2}
            value={input}
          />
          <Button
            disabled={busy || uploading || (input.trim().length === 0 && !attachment)}
            size="medium"
            type="submit"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
