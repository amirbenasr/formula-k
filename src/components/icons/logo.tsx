import clsx from 'clsx'
import Image from 'next/image'
import React from 'react'

type LogoIconProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  priority?: boolean
}

export function LogoIcon({ className, priority, ...props }: LogoIconProps) {
  return (
    <div {...props} className={clsx('relative aspect-square w-8', className)}>
      <Image
        src="/logo.png"
        alt="Formula K"
        fill
        sizes="64px"
        priority={priority}
        className="object-contain"
      />
    </div>
  )
}
