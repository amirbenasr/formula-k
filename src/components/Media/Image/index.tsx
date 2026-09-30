import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/cn'
import NextImage from 'next/image'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { cssVariables } from '@/cssVariables'

const { breakpoints } = cssVariables

/**
 * Payload-aware `next/image` wrapper.
 *
 * This is deliberately **not** a client component: it used to hold a
 * `useState` for a "loading" flag whose value was never read, which pulled every
 * product tile on every page into the client bundle and cost hydration work for
 * nothing. Callers that need interactivity (the product gallery) are client
 * components themselves, so importing this module from them still works.
 */
export const Image: React.FC<MediaProps> = (props) => {
  const {
    alt: altFromProps,
    fill,
    height: heightFromProps,
    imgClassName,
    onClick,
    onLoad: onLoadFromProps,
    priority,
    quality: qualityFromProps,
    resource,
    size: sizeFromProps,
    src: srcFromProps,
    width: widthFromProps,
  } = props

  let width: number | undefined | null
  let height: number | undefined | null
  let alt = altFromProps
  let src: StaticImageData | string = srcFromProps || ''

  if (!src && resource && typeof resource === 'object') {
    const {
      alt: altFromResource,
      height: fullHeight,
      url,
      width: fullWidth,
    } = resource

    width = widthFromProps ?? fullWidth
    height = heightFromProps ?? fullHeight
    alt = altFromResource

    // Absolute URLs come from remote storage (S3/R2). Relative URLs are local
    // media served from this same app, so they must stay same-origin — prefixing
    // NEXT_PUBLIC_SERVER_URL breaks them whenever the app runs on another
    // host/port (previews, local dev on a non-default port).
    src = url || ''
  }

  // NOTE: this is used by the browser to determine which image to download at different screen sizes
  const sizes = sizeFromProps
    ? sizeFromProps
    : Object.entries(breakpoints)
        .map(([, value]) => `(max-width: ${value}px) ${value}px`)
        .join(', ')

  return (
    <NextImage
      alt={alt || ''}
      className={cn(imgClassName)}
      fill={fill}
      height={!fill ? height || heightFromProps : undefined}
      onClick={onClick}
      onLoad={onLoadFromProps}
      priority={priority}
      quality={qualityFromProps ?? 80}
      sizes={sizes}
      src={src}
      width={!fill ? width || widthFromProps : undefined}
    />
  )
}
