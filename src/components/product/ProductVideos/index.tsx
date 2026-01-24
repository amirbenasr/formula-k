'use client'

import { Product, Media } from '@/payload-types'
import Image from 'next/image'
import { Play, X } from 'lucide-react'
import { useState, useRef } from 'react'

interface ProductVideosProps {
  videos: NonNullable<Product['videos']>
  productTitle: string
}

export function ProductVideos({ videos, productTitle }: ProductVideosProps) {
  const [activeVideo, setActiveVideo] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  if (!videos || videos.length === 0) {
    return null
  }

  const getVideoThumbnail = (video: NonNullable<Product['videos']>[number]): string | null => {
    if (video.thumbnail && typeof video.thumbnail === 'object') {
      return (video.thumbnail as Media).url || null
    }
    if (video.videoType === 'upload' && video.videoFile && typeof video.videoFile === 'object') {
      const videoMedia = video.videoFile as Media
      return videoMedia.thumbnailURL || null
    }
    return null
  }

  const getVideoUrl = (video: NonNullable<Product['videos']>[number]): string | null => {
    if (video.videoType === 'upload' && video.videoFile && typeof video.videoFile === 'object') {
      return (video.videoFile as Media).url || null
    }
    if (video.videoType === 'external' && video.externalUrl) {
      return video.externalUrl
    }
    return null
  }

  const isExternalVideo = (url: string): boolean => {
    return url.includes('youtube') || url.includes('youtu.be') || url.includes('tiktok') || url.includes('instagram')
  }

  // Check if URL needs to be proxied (external video CDNs with CORS issues)
  const getProxiedUrl = (url: string): string => {
    // Don't proxy YouTube, TikTok, Instagram (they have their own embed systems)
    if (isExternalVideo(url)) {
      return url
    }
    // Don't proxy local uploads
    if (url.startsWith('/') || url.includes('localhost')) {
      return url
    }
    // Proxy external video CDN URLs
    if (url.includes('videowise.com') || url.includes('.mp4') || url.includes('.webm')) {
      return `/api/proxy-video?url=${encodeURIComponent(url)}`
    }
    return url
  }

  const getEmbedUrl = (url: string): string | null => {
    // YouTube
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`
    }
    // TikTok - redirect to tiktok
    if (url.includes('tiktok.com')) {
      return url // Will open in new tab
    }
    // Instagram - redirect to instagram
    if (url.includes('instagram.com')) {
      return url // Will open in new tab
    }
    return null
  }

  const handleVideoClick = (index: number) => {
    const video = videos[index]
    const videoUrl = getVideoUrl(video)

    if (!videoUrl) return

    if (isExternalVideo(videoUrl)) {
      const embedUrl = getEmbedUrl(videoUrl)
      if (embedUrl && (videoUrl.includes('youtube') || videoUrl.includes('youtu.be'))) {
        setActiveVideo(index)
        setIsModalOpen(true)
      } else {
        // Open TikTok/Instagram in new tab
        window.open(videoUrl, '_blank')
      }
    } else {
      setActiveVideo(index)
      setIsModalOpen(true)
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setActiveVideo(null)
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }

  const currentVideo = activeVideo !== null ? videos[activeVideo] : null
  const currentVideoUrl = currentVideo ? getVideoUrl(currentVideo) : null

  return (
    <>
      <div className="py-8">
        <h2 className="text-2xl font-serif font-bold mb-6">Vidéos du Produit</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {videos.map((video, index) => {
            const thumbnailUrl = getVideoThumbnail(video)
            const isVertical = video.isVertical !== false

            return (
              <div
                key={index}
                className="group cursor-pointer"
                onClick={() => handleVideoClick(index)}
              >
                <div
                  className={`relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 ${
                    isVertical ? 'aspect-[9/16]' : 'aspect-video'
                  }`}
                >
                  {thumbnailUrl ? (
                    <Image
                      src={thumbnailUrl}
                      alt={video.title || `${productTitle} video ${index + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
                  )}

                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 text-foreground fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {video.title && (
                  <p className="mt-2 text-sm font-medium text-foreground line-clamp-1">
                    {video.title}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Video Modal */}
      {isModalOpen && currentVideo && currentVideoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute -top-12 right-0 p-2 text-white hover:text-primary transition-colors"
              aria-label="Close video"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Video container */}
            <div
              className={`relative overflow-hidden rounded-xl bg-black ${
                currentVideo.isVertical !== false ? 'aspect-[9/16] max-h-[80vh] mx-auto' : 'aspect-video'
              }`}
              style={currentVideo.isVertical !== false ? { maxWidth: '400px' } : {}}
            >
              {isExternalVideo(currentVideoUrl) ? (
                // YouTube embed
                <iframe
                  src={getEmbedUrl(currentVideoUrl) || ''}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                // Uploaded or external MP4/WebM video
                <video
                  ref={videoRef}
                  src={getProxiedUrl(currentVideoUrl)}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              )}
            </div>

            {/* Video title */}
            {currentVideo.title && (
              <p className="mt-4 text-center text-white text-lg font-medium">
                {currentVideo.title}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
