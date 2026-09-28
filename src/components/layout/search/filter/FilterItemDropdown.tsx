'use client'

import { ChevronDownIcon } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import type { ListItem } from '.'

import { FilterItem } from './FilterItem'

export function FilterItemDropdown({ list }: { list: ListItem[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openSelect, setOpenSelect] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const sort = searchParams.get('sort')

  const active = useMemo(() => {
    const match = list.find((listItem) =>
      'path' in listItem ? pathname === listItem.path : (listItem.slug ?? null) === sort,
    )

    return match?.title ?? list[0]?.title ?? ''
  }, [list, pathname, sort])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpenSelect(false)
      }
    }

    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={openSelect}
        aria-haspopup="listbox"
        aria-label="Trier par"
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-border bg-card px-4 text-sm text-foreground"
        onClick={() => setOpenSelect((open) => !open)}
      >
        <span className="truncate">{active}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${openSelect ? 'rotate-180' : ''}`}
        />
      </button>

      {openSelect ? (
        <div
          className="absolute z-40 mt-2 w-full rounded-2xl border border-border bg-card p-3 shadow-hover"
          onClick={() => setOpenSelect(false)}
        >
          <ul className="flex flex-col">
            {list.map((item: ListItem, i) => (
              <FilterItem item={item} key={i} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
