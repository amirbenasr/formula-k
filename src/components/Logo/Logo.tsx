import Image from 'next/image'
import React from 'react'

/**
 * Formula K marks for the admin panel.
 *
 * The admin routes load Payload's own stylesheet, not the storefront's Tailwind
 * bundle, so utility classes such as `relative h-20 w-20` are inert there. This
 * file used to pair `<Image fill>` with exactly those classes, which meant the
 * `fill` image had no positioned, sized ancestor: it laid itself out against the
 * viewport, stretched across the whole login screen and swallowed the clicks
 * meant for the "Login" button.
 *
 * Both graphics below therefore own their sizing with inline styles — nothing to
 * depend on the host stylesheet, and nothing absolutely positioned that could
 * escape its box and cover a control.
 */

/** Above the login form (`admin.components.graphics.Logo`). */
export const Logo = () => (
  <div style={{ height: '5rem', position: 'relative', width: '5rem' }}>
    <Image
      alt="Formula K"
      fill
      priority
      sizes="160px"
      src="/logo.png"
      style={{ objectFit: 'contain' }}
    />
  </div>
)

/**
 * Admin header mark (`admin.components.graphics.Icon`).
 *
 * Fixed at the 18px of Payload's `.step-nav__home` slot rather than filling an
 * ancestor: that slot's inner wrapper has an automatic height, so a percentage
 * height would fall back to the image's intrinsic size and overflow the header.
 */
export const Icon = () => (
  <Image
    alt="Formula K"
    height={18}
    priority
    src="/logo.png"
    style={{ display: 'block', objectFit: 'contain' }}
    width={18}
  />
)
