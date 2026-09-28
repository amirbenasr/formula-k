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
  images: {
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
