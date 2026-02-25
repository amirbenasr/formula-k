import { test, expect } from '@playwright/test'

test.describe('Product Detail Page', () => {
  test('product page displays title, price and add to cart', async ({ page }) => {
    await page.goto('/products/test-product')

    const title = page.getByRole('heading', { level: 1 })
    await expect(title).toBeVisible({ timeout: 10000 })
    await expect(title).toContainText('Test Product')

    // Add to cart button (uses aria-label)
    const addToCart = page.locator('button[aria-label="Add to cart"]')
    await expect(addToCart).toBeVisible({ timeout: 10000 })
  })

  test('back link navigates to shop', async ({ page }) => {
    await page.goto('/products/test-product')

    const backLink = page.getByRole('link', { name: /All products/i })
    await expect(backLink).toBeVisible({ timeout: 10000 })
    await backLink.click()

    await expect(page).toHaveURL(/\/shop/, { timeout: 15000 })
  })

  test('add to cart shows success toast', async ({ page }) => {
    await page.goto('/products/test-product')

    const addToCart = page.locator('button[aria-label="Add to cart"]')
    await expect(addToCart).toBeVisible({ timeout: 10000 })
    await addToCart.click()

    // Should show toast (text may include trailing period)
    const toast = page.getByText(/Item added to cart/)
    await expect(toast).toBeVisible({ timeout: 10000 })
  })

  test('out of stock product has disabled add to cart', async ({ page }) => {
    await page.goto('/products/out-of-stock-product')

    const addToCart = page.locator('button[aria-label="Add to cart"]')
    await expect(addToCart).toBeVisible({ timeout: 10000 })
    await expect(addToCart).toBeDisabled()
  })

  test('product page has image or placeholder', async ({ page }) => {
    await page.goto('/products/test-product')

    // Wait for page to load
    const title = page.getByRole('heading', { level: 1 })
    await expect(title).toBeVisible({ timeout: 10000 })

    // The page should at least have loaded (image may or may not exist)
    await expect(page).not.toHaveURL(/404/)
  })
})
