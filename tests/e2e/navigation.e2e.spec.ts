import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('header renders with logo and nav elements', async ({ page }) => {
    await page.goto('/')

    const logo = page.getByText('Formula K').first()
    await expect(logo).toBeVisible()

    const searchButton = page.locator('button[aria-label="Search"]')
    await expect(searchButton).toBeVisible()

    const cartButton = page.locator('button[data-slot="sheet-trigger"]')
    await expect(cartButton).toBeVisible()
  })

  test('search toggle reveals search input', async ({ page }) => {
    await page.goto('/')

    const searchButton = page.locator('button[aria-label="Search"]')
    await searchButton.click()

    const searchInput = page.getByPlaceholder('Search products...')
    await expect(searchInput).toBeVisible()
  })

  test('cart icon opens cart sheet', async ({ page }) => {
    await page.goto('/')

    const cartButton = page.locator('button[data-slot="sheet-trigger"]')
    await cartButton.click()

    const cartTitle = page.getByRole('heading', { name: 'My Cart' })
    await expect(cartTitle).toBeVisible()
  })

  test('mobile menu opens and shows content', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const hamburger = page.locator('button[aria-label="Open menu"]')
    await expect(hamburger).toBeVisible()
    await hamburger.click()

    // Close button visible
    const closeButton = page.locator('button[aria-label="Close menu"]')
    await expect(closeButton).toBeVisible()

    // Sign in link visible — use .first() to avoid strict mode (2 Sign In links)
    const signInLink = page.getByRole('link', { name: 'Sign In' }).first()
    await expect(signInLink).toBeVisible()
  })

  test('footer renders', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
  })
})
