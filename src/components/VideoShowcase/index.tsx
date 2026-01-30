'use client'

import { Media, Product } from '@/payload-types'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { Pause, Play, ShoppingBag, Volume2, VolumeX } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

interface VideoShowcaseProps {
  products: Product[]
}

interface VideoItem {
  product: Product
  video: NonNullable<Product['videos']>[number]
}

export function VideoShowcase({ products }: VideoShowcaseProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})

  // Flatten products with videos into a list of video items
  const videoItems: VideoItem[] = products.flatMap((product) =>
    (product.videos || []).map((video) => ({
      product,
      video,
    })),
  )

  // Handle carousel scroll events and auto-play centered video
  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      const newIndex = api.selectedScrollSnap()
      setCurrentIndex(newIndex)

      // Auto-play the centered video
      if (videoItems.length > 0 && videoItems[newIndex]) {
        const newVideoId = `${videoItems[newIndex].product.id}-${newIndex}`
        setPlayingVideoId(newVideoId)
      }
    }

    // Wait for carousel to be ready, then trigger initial select
    const timer = setTimeout(() => {
      onSelect()
    }, 100)

    api.on('select', onSelect)
    return () => {
      clearTimeout(timer)
      api.off('select', onSelect)
    }
  }, [api, videoItems.length])

  // Click handler to center and play a video
  const handleVideoClick = useCallback(
    (index: number, videoId: string) => {
      if (api) {
        api.scrollTo(index)
      }
      setPlayingVideoId(videoId)
    },
    [api],
  )

  // Handle video playback based on playingVideoId
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video) return

      if (id === playingVideoId) {
        video.play().catch(() => {
          // Autoplay might be blocked
        })
      } else {
        video.pause()
        video.currentTime = 0
      }
    })
  }, [playingVideoId])

  // Update mute state for all videos
  useEffect(() => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.muted = isMuted
      }
    })
  }, [isMuted])

  const getVideoThumbnail = (video: VideoItem['video']): string | null => {
    if (video.thumbnail && typeof video.thumbnail === 'object') {
      return (video.thumbnail as Media).url || null
    }
    if (video.videoType === 'upload' && video.videoFile && typeof video.videoFile === 'object') {
      const videoMedia = video.videoFile as Media
      return videoMedia.thumbnailURL || videoMedia.url || null
    }
    return null
  }

  const getVideoUrl = (video: VideoItem['video']): string | null => {
    if (video.videoType === 'upload' && video.videoFile && typeof video.videoFile === 'object') {
      return (video.videoFile as Media).url || null
    }
    if (video.videoType === 'external' && video.externalUrl) {
      return video.externalUrl
    }
    return null
  }

  const getProxiedUrl = (url: string): string => {
    if (
      url.includes('youtube') ||
      url.includes('youtu.be') ||
      url.includes('tiktok') ||
      url.includes('instagram')
    ) {
      return url
    }
    if (url.startsWith('/') || url.includes('localhost')) {
      return url
    }
    if (url.includes('videowise.com') || url.includes('.mp4') || url.includes('.webm')) {
      return `/api/proxy-video?url=${encodeURIComponent(url)}`
    }
    return url
  }

  const getProductPrice = (product: Product): string => {
    const price = product.priceInUSD || 0
    return `${price.toFixed(2)} TND`
  }

  const getProductImage = (product: Product): string | null => {
    const gallery = product.gallery
    if (gallery && gallery.length > 0) {
      const firstImage = gallery[0]?.image
      if (firstImage && typeof firstImage === 'object') {
        return (firstImage as Media).url || null
      }
    }
    return null
  }

  const canPlayInline = (videoUrl: string | null): boolean => {
    if (!videoUrl) return false
    return (
      !videoUrl.includes('youtube') &&
      !videoUrl.includes('youtu.be') &&
      !videoUrl.includes('tiktok') &&
      !videoUrl.includes('instagram')
    )
  }

  const togglePlayPause = useCallback(
    (videoId: string) => {
      if (playingVideoId === videoId) {
        setPlayingVideoId(null)
      } else {
        setPlayingVideoId(videoId)
      }
    },
    [playingVideoId],
  )

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  if (videoItems.length === 0) {
    return null
  }

  return (
    <section className="py-16 overflow-hidden">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-serif font-bold">Voir en Action</h2>
            <p className="text-muted mt-1">Découvrez nos produits en vidéo</p>
          </div>
          <Link
            href="/shop"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Voir tous les produits
          </Link>
        </div>
      </div>

      {/* Full-width Carousel for centered effect */}
      <div className="relative px-4 md:px-12 lg:px-20 xl:px-32 2xl:px-40">
        <Carousel
          setApi={setApi}
          opts={{
            align: 'center',
            loop: true,
            skipSnaps: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {videoItems.map((item, index) => {
              const videoId = `${item.product.id}-${index}`
              const thumbnailUrl = getVideoThumbnail(item.video)
              const videoUrl = getVideoUrl(item.video)
              const proxiedVideoUrl = videoUrl ? getProxiedUrl(videoUrl) : null
              const productImage = getProductImage(item.product)
              const isActive = currentIndex === index
              const isPlaying = playingVideoId === videoId
              const isPlayable = canPlayInline(videoUrl)

              return (
                <CarouselItem
                  key={videoId}
                  className="pl-4 basis-[200px] sm:basis-[220px] md:basis-[250px] lg:basis-[280px] xl:basis-[300px] 2xl:basis-[320px] transition-all duration-300"
                >
                  <div
                    className={`relative transition-all duration-300 ${
                      isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-60'
                    }`}
                  >
                    {/* Video Container - Active video is taller */}
                    <div
                      className={`relative rounded-xl overflow-hidden bg-secondary transition-all duration-300 cursor-pointer ${
                        isActive ? 'aspect-[9/17]' : 'aspect-[9/14]'
                      }`}
                      onClick={() => handleVideoClick(index, videoId)}
                    >
                      {/* Video element */}
                      {isPlayable && proxiedVideoUrl && (
                        <video
                          ref={(el) => {
                            videoRefs.current[videoId] = el
                          }}
                          src={proxiedVideoUrl}
                          className="absolute inset-0 w-full h-full object-cover"
                          loop
                          muted={isMuted}
                          playsInline
                          poster={thumbnailUrl || undefined}
                        />
                      )}

                      {/* Fallback thumbnail for non-playable videos */}
                      {!isPlayable && (
                        <>
                          {thumbnailUrl ? (
                            <Image
                              src={thumbnailUrl}
                              alt={item.video.title || item.product.title}
                              fill
                              className="object-cover"
                            />
                          ) : productImage ? (
                            <Image
                              src={productImage}
                              alt={item.product.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                          )}
                        </>
                      )}

                      {/* Control buttons - Only show on active */}
                      {isPlayable && isActive && (
                        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleMute()
                            }}
                            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                          >
                            {isMuted ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePlayPause(videoId)
                            }}
                            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Video title badge */}
                      {item.video.title && isActive && (
                        <div className="absolute top-3 left-3 right-14 z-10">
                          <span className="inline-block px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs truncate max-w-full">
                            {item.video.title}
                          </span>
                        </div>
                      )}

                      {/* Gradient overlay at bottom */}
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    </div>

                    {/* Product Info with Thumbnail */}
                    <div className="mt-3 flex gap-3">
                      {/* Product Thumbnail */}
                      {productImage && (
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary relative"
                        >
                          <Image
                            src={productImage}
                            alt={item.product.title}
                            fill
                            className="object-cover"
                          />
                        </Link>
                      )}

                      {/* Product Text */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${item.product.slug}`}>
                          <h3 className="font-medium text-sm text-foreground line-clamp-1 hover:text-primary transition-colors">
                            {item.product.title}
                          </h3>
                        </Link>
                        <p className="text-sm font-semibold text-foreground">
                          {getProductPrice(item.product)}
                        </p>
                      </div>
                    </div>

                    {/* Add to Cart - Only on active */}
                    {isActive && (
                      <button className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-full border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Ajouter au panier
                      </button>
                    )}
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>

          {/* Navigation Arrows */}
          <CarouselPrevious className="left-0 md:left-4 lg:left-12 xl:left-24 2xl:left-32 bg-card shadow-lg border-0 hover:bg-primary hover:text-primary-foreground" />
          <CarouselNext className="right-0 md:right-4 lg:right-12 xl:right-24 2xl:right-32 bg-card shadow-lg border-0 hover:bg-primary hover:text-primary-foreground" />
        </Carousel>
      </div>

      {/* Dot indicators */}
      {videoItems.length > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {videoItems.slice(0, Math.min(videoItems.length, 10)).map((_, index) => (
            <button
              key={index}
              onClick={() => api?.scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                currentIndex === index ? 'bg-primary w-6' : 'bg-muted/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
