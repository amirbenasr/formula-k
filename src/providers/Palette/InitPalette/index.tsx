import Script from 'next/script'
import React from 'react'

import type { Palette } from '../types'

export const InitPalette: React.FC<{ palette: Palette }> = ({ palette }) => {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    document.documentElement.setAttribute('data-palette', '${palette}');
  })();
  `,
      }}
      id="palette-script"
      strategy="beforeInteractive"
    />
  )
}
