import { cn } from '@/utilities/cn'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import React from 'react'

type Props = {
  className?: string
  error?: React.ReactNode
  message?: React.ReactNode
  success?: React.ReactNode
  warning?: React.ReactNode
}

/**
 * Inline notice. The variant is carried by tone *and* an icon so a colour-blind
 * shopper is not the only one who can tell an error from a confirmation.
 * No baked-in vertical margin: the callers lay it out in their own stack.
 */
export const Message: React.FC<Props> = ({ className, error, message, success, warning }) => {
  const messageToRender = message || error || success || warning

  if (!messageToRender) {
    return null
  }

  const tone = error
    ? { Icon: AlertTriangle, className: 'border-error/40 bg-error/15' }
    : success
      ? { Icon: CheckCircle2, className: 'border-accent/40 bg-accent/15' }
      : warning
        ? { Icon: AlertTriangle, className: 'border-warning/60 bg-warning/20' }
        : { Icon: Info, className: 'border-border bg-secondary/40' }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-sm text-foreground',
        tone.className,
        className,
      )}
      role="status"
    >
      <tone.Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{messageToRender}</div>
    </div>
  )
}
