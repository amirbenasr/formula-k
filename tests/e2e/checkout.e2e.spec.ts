import { test, expect } from '@playwright/test'
import {
  CUSTOMER_AUTH_FILE,
  CUSTOMER_EMAIL,
  GUEST_EMAIL,
  TEST_ADDRESS,
} from './fixtures/test-data'

test.describe('Checkout (empty cart)', () => {
  test('shows empty cart message when visiting /checkout without items', async ({ page }) => {
    await page.goto('/checkout')

    const emptyMessage = page.getByText('Your cart is empty.')
    await expect(emptyMessage).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Checkout (authenticated)', () => {
  test.use({ storageState: CUSTOMER_AUTH_FILE })

  test('full COD checkout flow', async ({ page }) => {
    test.setTimeout(60000)

    // Add product to cart
    await page.goto('/products/test-product')
    const addToCart = page.locator('button[aria-label="Add to cart"]')
    await expect(addToCart).toBeVisible({ timeout: 15000 })
    await addToCart.click()
    await expect(page.getByText(/Item added to cart/)).toBeVisible({ timeout: 10000 })

    // Go to checkout
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')

    // User email should be displayed (contact section)
    await expect(page.locator('main').getByText(CUSTOMER_EMAIL)).toBeVisible({ timeout: 15000 })

    // "Not you?" / Log out link should be visible
    const logoutLink = page.getByRole('link', { name: /Log out/i })
    await expect(logoutLink).toBeVisible()

    // Address section — add a new address if none exists
    const addAddressButton = page.getByRole('button', { name: /Add a new address/i })
    const addressAlreadyExists = await page.getByText(TEST_ADDRESS.addressLine1).isVisible().catch(() => false)

    if (!addressAlreadyExists) {
      await expect(addAddressButton).toBeVisible({ timeout: 5000 })
      await addAddressButton.click()

      // Fill address form in the dialog
      await page.locator('input#firstName').fill(TEST_ADDRESS.firstName)
      await page.locator('input#lastName').fill(TEST_ADDRESS.lastName)
      await page.locator('input#addressLine1').fill(TEST_ADDRESS.addressLine1)
      await page.locator('input#city').fill(TEST_ADDRESS.city)
      await page.locator('input#postalCode').fill(TEST_ADDRESS.postalCode)

      // Select country
      const countryTrigger = page.locator('#country')
      await countryTrigger.click()
      await page.getByRole('option', { name: /France/i }).click()

      // Submit address
      await page.getByRole('button', { name: 'Submit' }).click()
    }

    // Address should now be shown
    await expect(page.getByText(TEST_ADDRESS.addressLine1)).toBeVisible({ timeout: 10000 })

    // Payment method should show COD
    await expect(page.getByText('Cash on Delivery')).toBeVisible()

    // Place order — wait for page to be fully ready
    const placeOrder = page.getByRole('button', { name: /Place Order/i })
    await expect(placeOrder).toBeEnabled({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await placeOrder.click()

    // Should redirect to order page after processing
    await expect(page).toHaveURL(/\/orders\//, { timeout: 45000 })
  })

  test('billing/shipping toggle shows separate address form', async ({ page }) => {
    // Add product to cart first
    await page.goto('/products/test-product')
    const addToCart = page.locator('button[aria-label="Add to cart"]')
    await expect(addToCart).toBeVisible({ timeout: 10000 })
    await addToCart.click()
    await expect(page.getByText(/Item added to cart/)).toBeVisible({ timeout: 10000 })

    await page.goto('/checkout')

    // Uncheck "Shipping is the same as billing"
    const shippingCheckbox = page.locator('#shippingTheSameAsBilling')
    if (await shippingCheckbox.isVisible()) {
      await shippingCheckbox.click()

      // A second address section should appear for shipping
      await expect(page.getByText(/shipping/i).first()).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Checkout (guest)', () => {
  test('guest checkout flow with COD', async ({ page }) => {
    test.setTimeout(60000)

    // Add product to cart
    await page.goto('/products/test-product')
    const addToCart = page.locator('button[aria-label="Add to cart"]')
    await expect(addToCart).toBeVisible({ timeout: 15000 })
    await addToCart.click()
    await expect(page.getByText(/Item added to cart/)).toBeVisible({ timeout: 10000 })

    // Go to checkout
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')

    // Guest: enter email
    const emailInput = page.locator('input#email[type="email"]')
    await expect(emailInput).toBeVisible({ timeout: 15000 })
    await emailInput.fill(GUEST_EMAIL)

    // Continue as guest
    const continueButton = page.getByRole('button', { name: /Continue as guest/i })
    await continueButton.click()

    // Add address
    const addAddressButton = page.getByRole('button', { name: /Add a new address/i })
    await expect(addAddressButton).toBeVisible({ timeout: 10000 })
    await addAddressButton.click()

    await page.locator('input#firstName').fill(TEST_ADDRESS.firstName)
    await page.locator('input#lastName').fill(TEST_ADDRESS.lastName)
    await page.locator('input#addressLine1').fill(TEST_ADDRESS.addressLine1)
    await page.locator('input#city').fill(TEST_ADDRESS.city)
    await page.locator('input#postalCode').fill(TEST_ADDRESS.postalCode)

    const countryTrigger = page.locator('#country')
    await countryTrigger.click()
    await page.getByRole('option', { name: /France/i }).click()

    await page.getByRole('button', { name: 'Submit' }).click()

    // Wait for address to be set
    await expect(page.getByText(TEST_ADDRESS.addressLine1)).toBeVisible({ timeout: 10000 })

    // Place order — wait for page to be fully ready
    const placeOrder = page.getByRole('button', { name: /Place Order/i })
    await expect(placeOrder).toBeEnabled({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await placeOrder.click()

    // Should redirect to order page
    await expect(page).toHaveURL(/\/orders\//, { timeout: 45000 })
  })
})
