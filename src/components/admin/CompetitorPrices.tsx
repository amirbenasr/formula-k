'use client'

import { Button, useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

import { formatPrice } from '@/lib/utils'
import type { CompetitorPrice } from '@/payload-types'

import './CompetitorPrices.scss'

/**
 * The "Competitor Prices" tab on the product edit view.
 *
 * Registered as a `ui` field, so it holds no data of its own: the prices live in
 * their own collection and are read back through the REST API. That keeps the
 * product document — and its version history — free of a growing array of
 * competitor rows.
 *
 * Rendered for admins only. Any signed-in user can reach `/admin`, including
 * customers, so hiding the UI is the client half of the same rule the endpoint
 * and the collection's access control enforce on the server.
 */

const baseClass = 'competitor-prices'

type FetchResponse = {
  checkedAt?: string
  error?: string
  /** Payload's own failure shape, e.g. `Route not found "..."`. */
  errors?: { message?: string }[]
  found?: number
  message?: string
  ok?: boolean
  scanned?: number
}

/**
 * Payload reports failures three different ways — our endpoint sets `error`, its
 * missing-route handler sets `message`, and its error handler sets `errors[]`.
 * Surfacing whichever is present beats showing a bare status code to an admin
 * who cannot see the server logs.
 */
const describeFailure = (data: FetchResponse, status: number): string =>
  data.error ?? data.message ?? data.errors?.[0]?.message ?? `The lookup failed (HTTP ${status}).`

/** "2 days ago" — a price check is only meaningful with its age next to it. */
const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime()

  if (!Number.isFinite(then)) return '—'

  const minutes = Math.round((Date.now() - then) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)

  if (hours < 24) return `${hours} h ago`

  const days = Math.round(hours / 24)

  return `${days} day${days === 1 ? '' : 's'} ago`
}

export const CompetitorPricesField = () => {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  const priceField = useFormFields(([fields]) => fields?.priceInUSD?.value)

  const [rows, setRows] = useState<CompetitorPrice[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [message, setMessage] = useState<null | string>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const isAdmin = Boolean((user as { roles?: string[] } | null)?.roles?.includes('admin'))
  const ourPrice =
    typeof priceField === 'number' && Number.isFinite(priceField) ? priceField : null

  const load = useCallback(async () => {
    if (!id) {
      setRows([])
      return
    }

    const params = new URLSearchParams()
    params.set('where[product][equals]', String(id))
    params.set('limit', '100')
    params.set('sort', 'competitorPrice')
    params.set('depth', '0')

    const response = await fetch(`/api/competitor-prices?${params.toString()}`, {
      credentials: 'same-origin',
    })

    if (!response.ok) throw new Error(`Could not load saved prices (HTTP ${response.status}).`)

    const data = (await response.json()) as { docs?: CompetitorPrice[] }

    setRows(data.docs ?? [])
  }, [id])

  useEffect(() => {
    if (!isAdmin) return

    let cancelled = false

    load()
      .then(() => {
        if (!cancelled) setLoadFailed(false)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin, load])

  const check = useCallback(async () => {
    if (!id) return

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/competitor-prices/fetch', {
        body: JSON.stringify({ productId: id }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const data = (await response.json()) as FetchResponse

      if (!response.ok || data.ok === false) {
        setError(describeFailure(data, response.status))
        return
      }

      setMessage(
        data.message ??
          `Found ${data.found ?? 0} competitor price${data.found === 1 ? '' : 's'} in ${data.scanned ?? 0} search results.`,
      )

      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lookup failed.')
    } finally {
      setBusy(false)
    }
  }, [id, load])

  if (!isAdmin) return null

  const visible = (rows ?? []).filter((row) => !row.ignored)
  const hidden = (rows?.length ?? 0) - visible.length
  const cheapest = visible.length > 0 ? Math.min(...visible.map((row) => row.competitorPrice)) : null
  const cheaperThanUs =
    ourPrice !== null && visible.some((row) => row.competitorPrice < ourPrice)
  const lastChecked = visible.reduce<null | string>(
    (latest, row) =>
      row.fetchedAt && (!latest || row.fetchedAt > latest) ? row.fetchedAt : latest,
    null,
  )

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__header`}>
        <div>
          <h3 className={`${baseClass}__title`}>What competitors charge</h3>
          <p className={`${baseClass}__hint`}>
            Searches Google for this product&apos;s title and keeps the prices it finds in Tunisian
            shops.{' '}
            {lastChecked ? `Last checked ${relativeTime(lastChecked)}.` : 'Never checked yet.'}
          </p>
        </div>

        <Button
          buttonStyle="secondary"
          disabled={busy || !id}
          onClick={check}
          size="small"
          type="button"
        >
          {busy ? 'Checking…' : 'Check prices'}
        </Button>
      </div>

      {!id && (
        <p className={`${baseClass}__notice`}>
          Save this product first — the lookup needs a saved product to attach prices to.
        </p>
      )}

      {error && <p className={`${baseClass}__error`}>{error}</p>}
      {message && !error && <p className={`${baseClass}__notice`}>{message}</p>}
      {loadFailed && <p className={`${baseClass}__error`}>Could not load saved prices.</p>}

      {id && rows !== null && (
        <>
          <p className={`${baseClass}__ours`}>
            Our price:{' '}
            <strong>{ourPrice === null ? 'set in variants' : formatPrice(ourPrice)}</strong>
            {cheaperThanUs && (
              <span className={`${baseClass}__warning`}>
                {' '}
                — a competitor is cheaper than us
              </span>
            )}
          </p>

          {visible.length === 0 ? (
            <p className={`${baseClass}__notice`}>
              No competitor prices saved yet. Use <strong>Check prices</strong> to look them up, or
              add a row by hand under Content → Competitor Prices.
            </p>
          ) : (
            <table className={`${baseClass}__table`}>
              <thead>
                <tr>
                  <th scope="col">Competitor</th>
                  <th scope="col">Their listing</th>
                  <th scope="col">Price</th>
                  <th scope="col">vs ours</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const delta = ourPrice === null ? null : row.competitorPrice - ourPrice

                  return (
                    <tr
                      className={[
                        row.competitorPrice === cheapest ? `${baseClass}__row--cheapest` : '',
                        delta !== null && delta < 0 ? `${baseClass}__row--cheaper` : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={row.id}
                    >
                      <td>
                        {row.url ? (
                          <a href={row.url} rel="noopener noreferrer" target="_blank">
                            {row.source}
                          </a>
                        ) : (
                          row.source
                        )}
                        {row.matchConfidence === 'uncertain' && (
                          <span className={`${baseClass}__flag`} title="The listing may be a different product">
                            uncertain
                          </span>
                        )}
                      </td>
                      <td className={`${baseClass}__listing`} title={row.title ?? ''}>
                        {row.title ?? '—'}
                      </td>
                      <td className={`${baseClass}__price`}>
                        {formatPrice(row.competitorPrice)}
                        {row.previousPrice !== null && row.previousPrice !== undefined && (
                          <span className={`${baseClass}__previous`}>
                            was {formatPrice(row.previousPrice)}
                          </span>
                        )}
                      </td>
                      <td className={`${baseClass}__delta`}>
                        {delta === null
                          ? '—'
                          : `${delta > 0 ? '+' : ''}${formatPrice(delta)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <p className={`${baseClass}__footer`}>
            {hidden > 0 && `${hidden} row${hidden === 1 ? '' : 's'} hidden. `}
            <a href={`/admin/collections/competitor-prices?where[product][equals]=${id}`}>
              Manage all competitor prices
            </a>
          </p>
        </>
      )}
    </div>
  )
}
