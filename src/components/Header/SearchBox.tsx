'use client'

import { formatPrice } from '@/lib/utils'
import { cn } from '@/utilities/cn'
import { Loader2, Search, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

type Result = {
  id: number
  title: string
  slug: string
  price?: number
  imageUrl?: string
  soldOut: boolean
  requiresVariant: boolean
}

type Props = {
  /** Larger variant used on the mobile header panel */
  autoFocus?: boolean
  onNavigate?: () => void
  className?: string
  inputId?: string
}

/**
 * Header search with instant results.
 * Falls back to the full /shop?q= listing on submit.
 */
export function SearchBox({ autoFocus, onNavigate, className, inputId }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const id = inputId ?? generatedId

  // Debounced type-ahead.
  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=6`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('search failed')
        const data = (await response.json()) as { results: Result[] }
        setResults(data.results ?? [])
        setOpen(true)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  // Close the panel on outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = query.trim()
      setOpen(false)
      onNavigate?.()
      router.push(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : '/shop')
    },
    [onNavigate, query, router],
  )

  const showPanel = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={submit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="search"
          name="q"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Rechercher un produit, une marque…"
          aria-label="Rechercher un produit"
          className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-hover">
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche…
            </div>
          ) : null}

          {!loading && results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted">
              Aucun produit pour «&nbsp;{query.trim()}&nbsp;».
            </div>
          ) : null}

          {results.length > 0 ? (
            <ul className="max-h-[70vh] overflow-y-auto">
              {results.map((result) => (
                <li key={result.id} className="border-b border-border/60 last:border-b-0">
                  <Link
                    href={`/products/${result.slug}`}
                    onClick={() => {
                      setOpen(false)
                      onNavigate?.()
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-secondary/30"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#faf6f5]">
                      {result.imageUrl ? (
                        <Image
                          src={result.imageUrl}
                          alt={result.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13px] font-medium text-foreground">
                        {result.title}
                      </span>
                      {result.soldOut ? (
                        <span className="text-[11px] text-error">Rupture de stock</span>
                      ) : typeof result.price === 'number' ? (
                        <span className="text-[13px] font-semibold text-foreground">
                          {formatPrice(result.price)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}

              <li>
                <Link
                  href={`/shop?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => {
                    setOpen(false)
                    onNavigate?.()
                  }}
                  className="block bg-secondary/20 px-4 py-2.5 text-center text-[13px] font-medium text-primary-ink hover:underline"
                >
                  Voir tous les résultats
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
