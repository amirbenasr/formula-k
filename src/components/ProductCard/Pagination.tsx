import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  page: number
  totalPages: number
  /** Builds the href for a page number (including page 1). */
  hrefForPage: (page: number) => string
  className?: string
}

/** Small window of page numbers around the current page, with `…` for gaps. */
function pageWindow(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, page])

  if (page - 1 > 0) pages.add(page - 1)
  if (page + 1 <= totalPages) pages.add(page + 1)

  return [...pages].sort((a, b) => a - b)
}

/** French pager shared by every product listing. Hidden when there is one page. */
export function ProductPagination({ page, totalPages, hrefForPage, className }: Props) {
  if (totalPages <= 1) return null

  const pages = pageWindow(page, totalPages)

  return (
    <nav
      aria-label="Pagination des produits"
      className={cn('mt-8 flex flex-wrap items-center justify-center gap-2', className)}
    >
      {page > 1 ? (
        <Button asChild size="default" variant="outline">
          <Link href={hrefForPage(page - 1)} rel="prev">
            <ChevronLeft />
            Précédent
          </Link>
        </Button>
      ) : (
        <Button disabled size="default" variant="outline">
          <ChevronLeft />
          Précédent
        </Button>
      )}

      <ul className="flex flex-wrap items-center justify-center gap-1">
        {pages.map((number, index) => {
          const previous = pages[index - 1]
          const hasGap = previous !== undefined && number - previous > 1

          return (
            <React.Fragment key={number}>
              {hasGap ? (
                <li aria-hidden="true" className="px-1 text-muted">
                  …
                </li>
              ) : null}
              <li>
                {number === page ? (
                  <Button
                    aria-current="page"
                    className="pointer-events-none"
                    size="icon"
                    variant="default"
                  >
                    {number}
                  </Button>
                ) : (
                  <Button asChild size="icon" variant="outline">
                    <Link aria-label={`Page ${number}`} href={hrefForPage(number)}>
                      {number}
                    </Link>
                  </Button>
                )}
              </li>
            </React.Fragment>
          )
        })}
      </ul>

      {page < totalPages ? (
        <Button asChild size="default" variant="outline">
          <Link href={hrefForPage(page + 1)} rel="next">
            Suivant
            <ChevronRight />
          </Link>
        </Button>
      ) : (
        <Button disabled size="default" variant="outline">
          Suivant
          <ChevronRight />
        </Button>
      )}
    </nav>
  )
}
