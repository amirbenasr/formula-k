import type { APIRequestContext } from '@playwright/test'
import { BASE_URL } from '../fixtures/test-data'

/**
 * Create a user as an authenticated admin (can set roles and _verified).
 * The request context must already have admin auth cookies from loginUser().
 */
export async function createUserAsAdmin(
  request: APIRequestContext,
  email: string,
  password: string,
  roles: string[] = ['customer'],
) {
  const response = await request.post(`${BASE_URL}/api/users`, {
    data: { email, password, _verified: true, roles },
  })
  return response
}

/**
 * Login a user via the Payload REST API.
 * Sets cookies on the request context for subsequent authenticated calls.
 */
export async function loginUser(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${BASE_URL}/api/users/login`, {
    data: { email, password },
  })
  return response
}

/**
 * Fetch the first brand from the database.
 * Returns the brand ID or undefined if none exist.
 */
export async function getFirstBrandId(request: APIRequestContext): Promise<number | undefined> {
  const response = await request.get(`${BASE_URL}/api/brands?limit=1`)
  if (response.ok()) {
    const data = await response.json()
    return data.docs?.[0]?.id
  }
  return undefined
}

/**
 * Create a product via the Payload REST API.
 * Request context must have admin auth cookies (from loginUser).
 */
export async function createProduct(
  request: APIRequestContext,
  data: {
    title: string
    slug: string
    brand: number
    inventory?: number
    priceInUSD?: number
    gallery?: (string | number)[]
    enableVariants?: boolean
    _status?: string
  },
) {
  const response = await request.post(`${BASE_URL}/api/products`, {
    data: {
      _status: 'published',
      layout: [],
      priceInUSDEnabled: true,
      inventory: 100,
      priceInUSD: 1500,
      ...data,
    },
  })
  return response
}

/**
 * Upload a test image to the media collection.
 * Uses a tiny 1x1 PNG generated as a buffer.
 */
export async function seedTestImage(request: APIRequestContext) {
  // Minimal 1x1 red PNG
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  const pngBuffer = Buffer.from(pngBase64, 'base64')

  const response = await request.post(`${BASE_URL}/api/media`, {
    multipart: {
      file: {
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      },
      alt: 'Test product image',
    },
  })
  return response
}
