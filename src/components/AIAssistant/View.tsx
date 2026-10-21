import { checkRole } from '@/access/utilities'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'

import type { User } from '@/payload-types'

import { AssistantPanel } from './AssistantPanel'
import { displayFirstName } from './utils'
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
  const viewer = req.user as null | User
  const isAdmin = Boolean(viewer && checkRole(['admin'], viewer))

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
          <AssistantPanel userName={displayFirstName(viewer?.name, viewer?.email)} />
        ) : (
          <div className="ai-assistant__denied">
            <h1>Assistant is admin-only</h1>
            <p>
              The AI assistant can read the store and prepare catalogue changes, so it is restricted
              to administrators. Ask the store owner to add the <strong>admin</strong> role to your
              account.
            </p>
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
