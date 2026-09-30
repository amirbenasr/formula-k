import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/**
 * Media is stored on Cloudflare R2 in production and is served from a public host
 * that is usually different from the site URL. Without these patterns every
 * product photo would fail to render through next/image.
 */
const mediaHostPatterns = [
  process.env.R2_PUBLIC_URL,
  process.env.NEXT_PUBLIC_R2_URL,
  process.env.NEXT_PUBLIC_MEDIA_URL,
]
  .filter(Boolean)
  .map((value) => {
    const url = new URL(value)

    return {
      hostname: url.hostname,
      protocol: url.protocol.replace(':', ''),
    }
  })

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removes the `x-powered-by` header from every response.
  poweredByHeader: false,
  images: {
    /**
     * Optimised images are immutable: Payload names every upload with a
     * timestamp, so a replaced file always gets a new URL. Next's default of 60
     * seconds made Vercel re-fetch and re-encode every product photo once a
     * minute per size; matching the CDN's 31-day ceiling removes that work.
     */
    minimumCacheTTL: 2678400,
    // AVIF is ~20-30% smaller than WebP for product photography; WebP stays as
    // the fallback for browsers that cannot decode it.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      ...mediaHostPatterns,
      {
        hostname: 'images.unsplash.com',
        protocol: 'https',
      },
    ],
  },
  reactStrictMode: true,
  redirects,
  /**
   * Media binaries are served by Payload's `/api/media/file/:filename` route,
   * which streams the file from R2 (or local disk) through a serverless
   * function on every uncached request. Filenames are content-addressed by
   * upload time, so both the browser and Vercel's edge can hold them
   * indefinitely.
   */
  async headers() {
    return [
      {
        source: '/api/media/file/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig)
