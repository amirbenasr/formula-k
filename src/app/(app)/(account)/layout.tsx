import type { ReactNode } from 'react'

import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { RenderParams } from '@/components/RenderParams'
import { AccountNav } from '@/components/AccountNav'

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <div className="container py-8 lg:py-12">
      <RenderParams />

      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        {user ? (
          <AccountNav className="md:sticky md:top-24 md:w-56 md:shrink-0 md:self-start" />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
      </div>
    </div>
  )
}
