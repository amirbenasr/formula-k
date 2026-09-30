import { checkRole } from '@/access/utilities'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import type { User } from '@/payload-types'

import { Chat } from './Chat'
import './index.scss'

/**
 * Server component backing the /admin/ai route.
 *
 * Custom admin views are PUBLIC by default — Payload does not gate them for
 * you — so the admin check happens here, before any client code is rendered.
 * We read the identity from `initPageResult.req.user` rather than the `user`
 * prop, because the prop has field-level read access applied to it.
 */
export function AIAssistantView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const { req } = initPageResult
  const isAdmin = Boolean(req.user && checkRole(['admin'], req.user as User))

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        {isAdmin ? (
          <Chat />
        ) : (
          <div className="ai-assistant__denied">
            <h1>Not authorised</h1>
            <p>The AI assistant is restricted to administrators.</p>
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
