import { NextRequest, NextResponse } from 'next/server'

/**
 * Video proxy route to bypass CORS restrictions for external video CDNs
 * Usage: /api/proxy-video?url=https://cdn2.videowise.com/...
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate URL is from allowed domains
  const allowedDomains = [
    'cdn2.videowise.com',
    'cdn.videowise.com',
    'videowise.com',
    // Add other trusted video CDNs here
  ]

  try {
    const videoUrl = new URL(url)
    const isAllowed = allowedDomains.some((domain) => videoUrl.hostname.includes(domain))

    if (!isAllowed) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
    }

    // Fetch the video
    const response = await fetch(url, {
      headers: {
        // Some CDNs check the referer
        Referer: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status },
      )
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')

    // Stream the video back
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    }

    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Video proxy error:', error)
    return NextResponse.json({ error: 'Failed to proxy video' }, { status: 500 })
  }
}
