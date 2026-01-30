import clsx from 'clsx'
import { XIcon } from 'lucide-react'
import React from 'react'

export function CloseCart({ className }: { className?: string }) {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground transition-colors">
      <XIcon className={clsx('h-6 transition-all ease-in-out hover:scale-110 ', className)} />
    </div>
  )
}
