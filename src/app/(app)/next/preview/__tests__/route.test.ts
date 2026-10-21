import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  loggerError: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    find: mocks.find,
    logger: { error: mocks.loggerError },
  })),
}))

vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ disable: mocks.disable, enable: mocks.enable })),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@payload-config', () => ({ default: {} }))

const { GET } = await import('../route')

const admin = { id: 1, collection: 'users', email: 'admin@formula-k.tn', roles: ['admin'] }

const previewRequest = (query = 'collection=products&slug=tint-brow') =>
  new Request(`http://localhost:3000/next/preview?${query}`, {
    headers: { cookie: 'payload-token=test' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ permissions: {}, user: admin })
  mocks.find.mockResolvedValue({ totalDocs: 1 })
})

describe('GET /next/preview', () => {
  it('enables draft mode and redirects an admin to the document', async () => {
    const response = await GET(previewRequest())

    expect(mocks.enable).toHaveBeenCalledOnce()
    expect(mocks.disable).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledWith('/products/tint-brow')
    // The redirect aborts the response, so nothing is returned.
    expect(response).toBeUndefined()
  })

  it('works without a previewSecret (regression: production 403)', async () => {
    await GET(previewRequest('collection=products&slug=tint-brow&previewSecret='))

    expect(mocks.redirect).toHaveBeenCalledWith('/products/tint-brow')
  })

  it('accepts a legacy link that repeats the matching path', async () => {
    await GET(
      previewRequest('collection=products&slug=tint-brow&path=%2Fproducts%2Ftint-brow'),
    )

    expect(mocks.redirect).toHaveBeenCalledWith('/products/tint-brow')
  })

  it('checks the document can be read by the user without bypassing access control', async () => {
    await GET(previewRequest())

    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        draft: true,
        overrideAccess: false,
        user: admin,
        where: { slug: { equals: 'tint-brow' } },
      }),
    )
  })

  it('refuses anonymous visitors', async () => {
    mocks.auth.mockResolvedValue({ permissions: {}, user: null })

    const response = await GET(previewRequest())

    expect(response?.status).toBe(403)
    expect(mocks.disable).toHaveBeenCalled()
    expect(mocks.enable).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('refuses signed-in customers', async () => {
    mocks.auth.mockResolvedValue({ permissions: {}, user: { ...admin, roles: ['customer'] } })

    const response = await GET(previewRequest())

    expect(response?.status).toBe(403)
    expect(mocks.enable).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('refuses when the session cannot be verified', async () => {
    mocks.auth.mockRejectedValue(new Error('bad token'))

    const response = await GET(previewRequest())

    expect(response?.status).toBe(403)
    expect(mocks.loggerError).toHaveBeenCalled()
    expect(mocks.enable).not.toHaveBeenCalled()
  })

  it('404s when the document does not exist', async () => {
    mocks.find.mockResolvedValue({ totalDocs: 0 })

    const response = await GET(previewRequest())

    expect(response?.status).toBe(404)
    expect(mocks.enable).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('rejects bad params without touching the session', async () => {
    const response = await GET(previewRequest('collection=orders&slug=x'))

    expect(response?.status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.enable).not.toHaveBeenCalled()
  })

  it('rejects a path that does not belong to the document', async () => {
    const response = await GET(
      previewRequest('collection=products&slug=tint-brow&path=%2Fadmin'),
    )

    expect(response?.status).toBe(400)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
