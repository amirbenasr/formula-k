import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utilities/cn'

/**
 * Single button language for the whole storefront.
 *
 * Geometry: pill (rounded-full) at h-11, so every action is a comfortable tap
 * target on a phone. Colours always derive from the live palette tokens
 * (`--primary`, `--secondary`) — never hard-code a palette shade such as
 * `primary-600`, otherwise the "cool" palette breaks.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:scale-[0.98]',
        destructive: 'bg-destructive text-white shadow-soft hover:bg-destructive/90',
        outline:
          'border border-border bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-primary/5 hover:text-primary-ink',
        secondary: 'bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/70',
        ghost: 'text-foreground/75 hover:bg-secondary/60 hover:text-foreground',
        link: 'text-primary-ink underline-offset-4 hover:underline',
        nav: 'text-primary-ink/50 hover:text-primary-ink [&.active]:text-primary-ink p-0 pt-2 pb-6 uppercase font-mono tracking-widest text-xs',
      },
      size: {
        clear: '',
        default: 'h-11 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-9 gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-12 px-7 text-[15px] has-[>svg]:px-5',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
