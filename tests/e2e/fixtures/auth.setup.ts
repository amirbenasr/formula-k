import { test as setup } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  ADMIN_AUTH_FILE,
  CUSTOMER_AUTH_FILE,
  AUTH_DIR,
  BASE_URL,
} from './test-data'
import {
  createUserAsAdmin,
  loginUser,
  getFirstBrandId,
  createProduct,
} from '../helpers/api-helpers'

setup('create test users and save auth states', async ({ request, browser }) => {
  // Ensure .auth directory exists
  const authDir = path.resolve(AUTH_DIR)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // Step 1: Login as existing admin via API (sets cookies on request context)
  const adminLoginRes = await loginUser(request, ADMIN_EMAIL, ADMIN_PASSWORD)
  if (!adminLoginRes.ok()) {
    throw new Error(
      `Cannot login as admin (${ADMIN_EMAIL}). ` +
        'Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars to a valid admin account. ' +
        `Response: ${adminLoginRes.status()} ${await adminLoginRes.text()}`,
    )
  }
  console.log('Admin login successful')

  // Step 2: Create customer test user as admin (sets _verified + roles)
  const customerRes = await createUserAsAdmin(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, [
    'customer',
  ])
  console.log('Customer user:', customerRes.ok() ? 'created' : 'already exists')

  // Step 3: Save admin auth state via browser login
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await adminPage.goto(`${BASE_URL}/login`)
  await adminPage.locator('input#email').fill(ADMIN_EMAIL)
  await adminPage.locator('input#password').fill(ADMIN_PASSWORD)
  await adminPage.getByRole('button', { name: 'Continue' }).click()
  await adminPage.waitForURL(/\/account/, { timeout: 15000 })
  await adminContext.storageState({ path: ADMIN_AUTH_FILE })
  await adminContext.close()
  console.log('Admin auth state saved')

  // Step 4: Save customer auth state via browser login
  const customerContext = await browser.newContext()
  const customerPage = await customerContext.newPage()
  await customerPage.goto(`${BASE_URL}/login`)
  await customerPage.locator('input#email').fill(CUSTOMER_EMAIL)
  await customerPage.locator('input#password').fill(CUSTOMER_PASSWORD)
  await customerPage.getByRole('button', { name: 'Continue' }).click()
  await customerPage.waitForURL(/\/account/, { timeout: 15000 })
  await customerContext.storageState({ path: CUSTOMER_AUTH_FILE })
  await customerContext.close()
  console.log('Customer auth state saved')
})

setup('seed test products', async ({ request }) => {
  // Login as admin (sets cookies for all subsequent API calls)
  await loginUser(request, ADMIN_EMAIL, ADMIN_PASSWORD)

  // Get the first brand ID (required field for products)
  const brandId = await getFirstBrandId(request)
  if (!brandId) {
    console.warn('No brands found in DB — product seeding may fail')
    return
  }
  console.log('Using brand ID:', brandId)

  // Create test products (idempotent — slug collision returns error, we just skip)
  const productRes = await createProduct(request, {
    title: 'Test Product',
    slug: 'test-product',
    brand: brandId,
    inventory: 100,
    priceInUSD: 1500,
  })
  console.log('Test Product:', productRes.ok() ? 'created' : `skipped (${productRes.status()})`)

  const oosRes = await createProduct(request, {
    title: 'Out of Stock Product',
    slug: 'out-of-stock-product',
    brand: brandId,
    inventory: 0,
    priceInUSD: 2000,
  })
  console.log('Out of Stock Product:', oosRes.ok() ? 'created' : `skipped (${oosRes.status()})`)
})
