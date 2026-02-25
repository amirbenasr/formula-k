import { test, expect } from '@playwright/test'
import { CUSTOMER_AUTH_FILE, CUSTOMER_EMAIL } from './fixtures/test-data'

test.describe('Account (unauthenticated)', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/account')

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

test.describe('Account (authenticated)', () => {
  test.use({ storageState: CUSTOMER_AUTH_FILE })

  test('account page displays settings heading', async ({ page }) => {
    await page.goto('/account')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('Account settings')
  })

  test('account form is pre-filled with user email', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input#email')
    await expect(emailInput).toHaveValue(CUSTOMER_EMAIL, { timeout: 20000 })
  })

  test('update name shows success toast', async ({ page }) => {
    await page.goto('/account')

    // Wait for account data to load (email gets populated from server)
    await page.waitForLoadState('networkidle')
    const emailInput = page.locator('input#email')
    await expect(emailInput).toHaveValue(CUSTOMER_EMAIL, { timeout: 20000 })

    const nameInput = page.locator('input#name')
    await expect(nameInput).toBeVisible()

    // Use a unique name to guarantee the form detects a change
    const uniqueName = `Test Customer ${Date.now()}`
    // Triple-click to select all text, then type over it
    await nameInput.click({ clickCount: 3 })
    await nameInput.pressSequentially(uniqueName, { delay: 50 })

    // Wait for the button to become enabled (form detects change)
    const updateButton = page.getByRole('button', { name: 'Update Account' })
    await expect(updateButton).toBeEnabled({ timeout: 5000 })
    await updateButton.click()

    const success = page.getByText('Successfully updated account')
    await expect(success).toBeVisible({ timeout: 10000 })
  })

  test('change password toggle shows password fields', async ({ page }) => {
    await page.goto('/account')

    const changePasswordLink = page.getByRole('button', { name: /click here/i })
    await changePasswordLink.click()

    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.locator('input#passwordConfirm')).toBeVisible()

    // Cancel should hide them
    const cancelButton = page.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    await expect(page.locator('input#password')).not.toBeVisible()
  })

  test('recent orders section is visible', async ({ page }) => {
    await page.goto('/account')

    const ordersHeading = page.getByRole('heading', { name: 'Recent Orders' })
    await expect(ordersHeading).toBeVisible()
  })

  test('account sidebar navigation is visible on desktop', async ({ page }) => {
    await page.goto('/account')

    // Sidebar links — use exact: true to avoid matching "View all orders"
    await expect(page.getByRole('link', { name: 'Account settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Addresses' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Orders', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Glow Rewards/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log out' })).toBeVisible()
  })

  test('orders page loads', async ({ page }) => {
    await page.goto('/orders')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('Orders')
  })

  test('addresses page loads', async ({ page }) => {
    await page.goto('/account/addresses')

    // Should show addresses page content
    await expect(page.getByRole('button', { name: /Add a new address/i })).toBeVisible()
  })
})
