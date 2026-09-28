import * as React from 'react'

import { cn } from '@/utilities/cn'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-border/80 placeholder:text-muted-foreground/70 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-24 w-full rounded-xl border bg-background px-4 py-3 text-base shadow-xs transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-secondary/40 disabled:opacity-60 md:text-[15px]',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
