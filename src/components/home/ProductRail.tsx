'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  children: React.ReactNode
  /** Tailwind width for each slide, e.g. "w-[70%] sm:w-[45%] lg:w-[23%]" */
  itemClassName?: string
  /** How many children to render before deciding arrows are useful */
  className?: string
}

/**
 * Horizontally scrollable product rail (YesStyle/Olive Young style).
 * Server-rendered cards are passed in as children; only the scroll controls are client-side.
 */
export function ProductRail({ children, itemClassName, className }: Props) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const items = React.Children.toArray(children)

  const updateArrows = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const maxScroll = track.scrollWidth - track.clientWidth
    setAtStart(track.scrollLeft <= 4)
    setAtEnd(track.scrollLeft >= maxScroll - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const track = trackRef.current
    if (!track) return
    track.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      track.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  const scrollBy = useCallback((direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.8, 240), behavior: 'smooth' })
  }, [])

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, index) => (
          <li
            key={index}
            className={cn(
              'shrink-0 snap-start',
              itemClassName ?? 'w-[68%] sm:w-[44%] lg:w-[23.5%]',
            )}
          >
            {child}
          </li>
        ))}
      </ul>

      {/* Identical ‹ › control in every scrollable rail; the text label itself
          lives in <SectionHeading /> so all rails share the same control set. */}
      <div className="pointer-events-none absolute -top-14 right-0 hidden gap-2 lg:flex">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => scrollBy(-1)}
          disabled={atStart}
          aria-label="Précédent"
          className="pointer-events-auto rounded-full"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => scrollBy(1)}
          disabled={atEnd}
          aria-label="Suivant"
          className="pointer-events-auto rounded-full"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
