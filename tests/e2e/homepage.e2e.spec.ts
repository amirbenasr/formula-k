import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SouGlowy/)
  })

  test('hero section renders with heading and CTAs', async ({ page }) => {
    await page.goto('/')

    const heroHeading = page.getByRole('heading', { level: 1 })
    await expect(heroHeading).toContainText('Secret de la Glass Skin')

    const discoverLink = page.getByRole('link', { name: 'Découvrir' }).first()
    await expect(discoverLink).toBeVisible()

    const routinesLink = page.getByRole('link', { name: 'Voir les Routines' })
    await expect(routinesLink).toBeVisible()
  })

  test('hero CTA link navigates to products or shop', async ({ page }) => {
    await page.goto('/')

    const discoverLink = page.getByRole('link', { name: 'Découvrir' }).first()
    await discoverLink.click()

    await expect(page).toHaveURL(/\/products|\/shop/)
  })

  test('feature icons section is visible', async ({ page }) => {
    await page.goto('/')

    // Use heading level 3 to target the icon headings specifically
    await expect(page.getByRole('heading', { name: 'Glass Skin', level: 3 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hydratation', level: 3 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Protection', level: 3 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Soin Doux', level: 3 })).toBeVisible()
  })

  test('categories section renders', async ({ page }) => {
    await page.goto('/')

    const categoriesHeading = page.getByText('Acheter par Catégorie')
    await expect(categoriesHeading).toBeVisible()
  })
})
