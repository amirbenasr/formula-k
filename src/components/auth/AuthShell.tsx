import { cn } from '@/utilities/cn'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
  description?: string
  /** Small contextual note under the card (e.g. a link to the other auth route). */
  footer?: React.ReactNode
  icon?: LucideIcon
  title: string
}

/**
 * One shell for every account/auth screen so /login, /create-account,
 * /forgot-password, /reset-password, /verify-email and /find-order share a
 * width, a heading scale and a vertical rhythm. They previously each rolled
 * their own container and drifted — one centred, one left-aligned, three
 * different heading sizes and two different field widths.
 */
export const AuthShell: React.FC<Props> = ({
  children,
  className,
  description,
  footer,
  icon: Icon,
  title,
}) => (
  <div className="container">
    <div className={cn('mx-auto my-10 w-full max-w-md sm:my-16', className)}>
      <div className="surface surface-pad sm:p-8">
        {Icon ? (
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
            <Icon className="h-5 w-5 text-primary-ink" />
          </span>
        ) : null}

        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">{title}</h1>

        {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}

        <div className="mt-6">{children}</div>
      </div>

      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </div>
  </div>
)

/** Inline link used inside auth copy. */
export const AuthLink: React.FC<{ children: React.ReactNode; href: string }> = ({
  children,
  href,
}) => (
  <Link
    className="inline-flex min-h-6 items-center font-medium text-primary-ink underline-offset-4 hover:underline"
    href={href}
  >
    {children}
  </Link>
)
