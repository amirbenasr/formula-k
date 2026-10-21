import { getPayload } from 'payload'

import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

import configPromise from '@payload-config'

import { checkRole } from '@/access/utilities'
import { parsePreviewSearchParams } from '@/utilities/preview'

const notAllowed = 'You are not allowed to preview this page'

/**
 * Turns on Next.js draft mode for an authenticated admin and redirects to the
 * storefront page of the document being edited.
 *
 * The admin session is the only credential: it is read from the `payload-token`
 * cookie (or an `Authorization` header) that the browser sends with the preview
 * link opening in a new tab. There is deliberately no shared `previewSecret`
 * query param — it was an extra credential that had to match between the link
 * generator and the running server, and a missing/empty `PREVIEW_SECRET` env var
 * made every preview fail with 403.
 */
export async function GET(req: Request): Promise<Response> {
  const payload = await getPayload({ config: configPromise })

  const preview = parsePreviewSearchParams(new URL(req.url).searchParams)

  if (!preview.ok) {
    return new Response(preview.message, { status: preview.status })
  }

  const { collection, path, slug } = preview.preview
  const draft = await draftMode()

  let user

  try {
    // `canSetHeaders` stays off: this route only redirects, so a refreshed token
    // cookie would be dropped on the floor anyway.
    ;({ user } = await payload.auth({ headers: req.headers }))
  } catch (error) {
    payload.logger.error({ err: error }, 'Error verifying token for live preview')
    draft.disable()
    return new Response(notAllowed, { status: 403 })
  }

  if (!user) {
    draft.disable()
    return new Response('Sign in to the admin panel to preview drafts', { status: 403 })
  }

  if (!checkRole(['admin'], user)) {
    draft.disable()
    return new Response(notAllowed, { status: 403 })
  }

  // Draft mode bypasses the storefront's published-only filter, so the document
  // has to exist and be readable by this user before it is switched on.
  const { totalDocs } = await payload.find({
    collection,
    depth: 0,
    draft: true,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    user,
    where: { slug: { equals: slug } },
  })

  if (totalDocs === 0) {
    draft.disable()
    return new Response('The document you are trying to preview does not exist', { status: 404 })
  }

  draft.enable()

  redirect(path)
}
