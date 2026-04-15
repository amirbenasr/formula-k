import Image from 'next/image'
import React from 'react'

export const Logo = () => {
  return (
    <div className="relative h-20 w-20">
      <Image src="/logo.png" alt="Formula K" fill sizes="160px" className="object-contain" priority />
    </div>
  )
}
