'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

type SplitHeroProps = Page['hero'] & {
  badge?: string | null
}

export const SplitHero: React.FC<SplitHeroProps> = ({ links, media, richText, badge }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('light')
  }, [setHeaderTheme])

  return (
    <section className="relative bg-secondary overflow-hidden">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[calc(100vh-10rem)] py-12 lg:py-0">
          {/* Left Content */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            {badge && (
              <span className="inline-flex self-start px-4 py-1.5 rounded-pill bg-primary/20 text-primary-700 text-sm font-medium mb-6">
                {badge}
              </span>
            )}

            {richText && (
              <RichText
                className="mb-8 [&_h1]:text-4xl [&_h1]:sm:text-5xl [&_h1]:lg:text-6xl [&_h1]:font-serif [&_h1]:text-foreground [&_h1]:leading-tight [&_h1]:mb-6 [&_p]:text-muted [&_p]:text-lg [&_p]:leading-relaxed"
                data={richText}
                enableGutter={false}
              />
            )}

            {Array.isArray(links) && links.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {links.map(({ link }, i) => {
                  return (
                    <CMSLink
                      key={i}
                      {...link}
                      appearance={i === 0 ? 'default' : 'outline'}
                      className={
                        i === 0
                          ? 'btn-primary'
                          : 'btn-outline'
                      }
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Image */}
          <div className="relative order-1 lg:order-2 flex justify-center lg:justify-end">
            {media && typeof media === 'object' && (
              <div className="relative w-full max-w-md lg:max-w-lg xl:max-w-xl aspect-[4/5] rounded-[2rem] overflow-hidden shadow-hover">
                <Media
                  fill
                  imgClassName="object-cover"
                  priority
                  resource={media}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decorative background curve */}
      <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-background to-transparent opacity-50 pointer-events-none" />
    </section>
  )
}
