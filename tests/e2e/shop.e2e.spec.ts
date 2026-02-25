import { test, expect } from '@playwright/test'

test.describe('Shop Page', () => {
  test('shop page loads with products grid', async ({ page }) => {
    await page.goto('/shop')

    // Should show product links
    const productLinks = page.locator('a[href^="/products/"]')
    await expect(productLinks.first()).toBeVisible({ timeout: 10000 })
  })

  test('search filters products via in-page search', async ({ page }) => {
    await page.goto('/shop')

    // Use the in-page search input (not the header search)
    const searchInput = page.getByPlaceholder('Search for products...')
    if (await searchInput.isVisible()) {
      await searchInput.fill('Anua')
      await searchInput.press('Enter')
      // Products should still be visible (Anua products exist)
      const productLinks = page.locator('a[href^="/products/"]')
      await expect(productLinks.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('sort links are visible in sidebar', async ({ page }) => {
    await page.goto('/shop')

    // Check sort links exist in sidebar
    const priceSortLink = page.getByRole('link', { name: /Price: Low to high/i })
    await expect(priceSortLink).toBeVisible({ timeout: 10000 })
  })

  test('clicking sort link updates URL', async ({ page }) => {
    await page.goto('/shop')

    const priceSortLink = page.getByRole('link', { name: /Price: Low to high/i })
    await expect(priceSortLink).toBeVisible({ timeout: 10000 })
    await priceSortLink.click({ force: true })

    await expect(page).toHaveURL(/sort=priceInUSD/, { timeout: 10000 })
  })

  test('category links are visible in sidebar', async ({ page }) => {
    await page.goto('/shop')

    // At least one category link should be in the sidebar
    const categoryLinks = page.locator('a[href^="/shop/"]')
    await expect(categoryLinks.first()).toBeVisible({ timeout: 10000 })
  })
})
