import type { ReactNode } from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { Providers } from '@/providers'
import { InitPalette } from '@/providers/Palette/InitPalette'
import type { Palette } from '@/providers/Palette/types'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'
import React from 'react'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cormorant',
  weight: ['400', '500', '600', '700'],
})

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Fetch site settings including color palette
  let palette: Palette = 'warm'
  try {
    const siteSettings = await getCachedGlobal('site-settings')()
    palette = (siteSettings?.colorPalette as Palette) || 'warm'
  } catch {
    // Default to warm if site settings don't exist yet
    palette = 'warm'
  }

  return (
    <html
      className={[inter.variable, cormorant.variable, GeistMono.variable].filter(Boolean).join(' ')}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <InitPalette palette={palette} />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body className="flex flex-col min-h-screen">
        <Providers palette={palette}>
          <AdminBar />
          <LivePreviewListener />

          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
