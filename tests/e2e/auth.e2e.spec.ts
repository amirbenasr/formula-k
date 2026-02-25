import { test, expect } from '@playwright/test'
import { CUSTOMER_AUTH_FILE } from './fixtures/test-data'

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('Log in')

    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')

    await page.locator('input#email').fill('wrong@example.com')
    await page.locator('input#password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Should show an error message (stays on login page)
    await expect(page).toHaveURL(/\/login/)
    // The form should show an error via the Message component
    const error = page.locator('.message--error, [class*="error"]')
    await expect(error).toBeVisible({ timeout: 10000 })
  })

  test('create account page renders correctly', async ({ page }) => {
    await page.goto('/create-account')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('Create Account')

    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.locator('input#passwordConfirm')).toBeVisible()
  })

  test('create account with valid data shows success', async ({ page }) => {
    await page.goto('/create-account')

    const uniqueEmail = `test-${Date.now()}@formulak.test`
    await page.locator('input#email').fill(uniqueEmail)
    await page.locator('input#password').fill('TestPassword123!')
    await page.locator('input#passwordConfirm').fill('TestPassword123!')
    await page.getByRole('button', { name: 'Create Account' }).click()

    // Should show success message
    const success = page.getByText('Check Your Email')
    await expect(success).toBeVisible({ timeout: 10000 })
  })

  test('create account with mismatched passwords shows error', async ({ page }) => {
    await page.goto('/create-account')

    await page.locator('input#email').fill('mismatch@formulak.test')
    await page.locator('input#password').fill('TestPassword123!')
    await page.locator('input#passwordConfirm').fill('DifferentPassword!')
    await page.getByRole('button', { name: 'Create Account' }).click()

    // Should remain on the create-account page with an error
    await expect(page).toHaveURL(/\/create-account/)
  })

  test('logout page shows logged out confirmation', async ({ page }) => {
    await page.goto('/logout')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toContainText(/logged out/i)
  })

  test('login link navigates from create account page', async ({ page }) => {
    await page.goto('/create-account')

    const loginLink = page.getByRole('link', { name: 'Login' })
    await expect(loginLink).toBeVisible()
    await loginLink.click()

    await expect(page).toHaveURL(/\/login/)
  })

  test('create account link navigates from login page', async ({ page }) => {
    await page.goto('/login')

    const createLink = page.getByRole('link', { name: /Create an account/i })
    await expect(createLink).toBeVisible()
    await createLink.click()

    await expect(page).toHaveURL(/\/create-account/)
  })
})

test.describe('Authentication (logged in)', () => {
  test.use({ storageState: CUSTOMER_AUTH_FILE })

  test('visiting /login when logged in redirects to /account', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/account/)
  })
})
