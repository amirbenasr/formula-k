'use client'

import { useChat } from '@ai-sdk/react'
import { Button } from '@payloadcms/ui'
import { DefaultChatTransport } from 'ai'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import './index.scss'

const baseClass = 'ai-assistant'

/** One row-level stock change, as returned by stage_inventory_update. */
type StockChange = { from: number; label: string; to: number }

/**
 * What the assistant returns for a catalogue operation. The model never renders
 * this: the tool returns the already-validated diff and the panel displays it,
 * so the admin reviews the same values applyAction will write.
 */
type CataloguePreview = {
  diffs?: Array<{ from?: unknown; label: string; to?: unknown }>
  op?: string
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
  'Publish a draft product',
  'How many orders came in this month?',
]

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

      {(output.problems ?? []).length > 0 && (
        <ul className={`${baseClass}__problems`}>
          {output.problems?.map((problem, index) => (
            <li key={index}>{problem}</li>
          ))}
        </ul>
      )}

      {isCatalogue && creates && (
        <p className={`${baseClass}__hint`}>
          Images and other media still have to be added in the admin panel after this is created.
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

  const submit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault()
      const text = input.trim()
      if (!text || busy) return
      void sendMessage({ text })
      setInput('')
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9 }))
    },
    [busy, input, sendMessage],
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
                    {part.text}
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
        <textarea
          className={`${baseClass}__input`}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
          onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="Ask about stock, orders, products or brands…"
          rows={2}
          value={input}
        />
        <Button disabled={busy || input.trim().length === 0} size="medium" type="submit">
          Send
        </Button>
      </form>
    </div>
  )
}
