import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  title: string
  subtitle?: string
  /** Small text above the title */
  eyebrow?: string
  href?: string
  /** Same label everywhere so every rail closes with the identical control */
  linkLabel?: string
  className?: string
  align?: 'left' | 'center'
}

/**
 * The single section-heading treatment for the storefront: muted uppercase
 * eyebrow, serif title, optional subtitle and one consistent "see more" control.
 */
export function SectionHeading({
  title,
  subtitle,
  eyebrow,
  href,
  linkLabel = 'Voir tout',
  className,
  align = 'left',
}: Props) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-3',
        align === 'center' && 'flex-col items-center text-center',
        className,
      )}
    >
      <div className={cn(align === 'center' && 'flex flex-col items-center')}>
        {eyebrow ? (
          <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-serif text-2xl font-medium leading-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>

      {href ? (
        <Button asChild variant="ghost" size="sm" className="group -mr-2 shrink-0">
          <Link href={href}>
            {linkLabel}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
