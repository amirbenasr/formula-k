import { cn } from '@/utilities/cn'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  title: string
  subtitle?: string
  /** Small text above the title */
  eyebrow?: string
  href?: string
  linkLabel?: string
  className?: string
  align?: 'left' | 'center'
}

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
          <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-serif text-2xl font-bold leading-tight text-foreground lg:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>

      {href ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  )
}
