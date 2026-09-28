import { test, expect } from '@playwright/test'

// Helper: open the cart sheet via the header cart trigger button
async function openCart(page: import('@playwright/test').Page) {
  const cartTrigger = page.locator('button[data-slot="sheet-trigger"]')
  await cartTrigger.click()
}

// Helper: add product to cart and wait for confirmation
async function addTestProductToCart(page: import('@playwright/test').Page) {
  await page.goto('/products/test-product')
  const addToCart = page.locator('button[aria-label="Ajouter au panier"]')
  await expect(addToCart).toBeVisible({ timeout: 10000 })
  await addToCart.click()
  // Toast reads "Ajouté au panier"
  await expect(page.getByText('Ajouté au panier')).toBeVisible({ timeout: 10000 })
}

test.describe('Cart', () => {
  test('empty cart shows empty message', async ({ page }) => {
    await page.goto('/')
    await openCart(page)

    const emptyMessage = page.getByText('Votre panier est vide')
    await expect(emptyMessage).toBeVisible()
  })

  test('adding product shows item in cart', async ({ page }) => {
    await addTestProductToCart(page)

    await openCart(page)

    const productInCart = page.getByRole('dialog').getByText('Test Product')
    await expect(productInCart).toBeVisible()
  })

  test('quantity controls work', async ({ page }) => {
    await addTestProductToCart(page)

    await openCart(page)

    // Increase quantity
    const increaseButton = page.locator('button[aria-label="Augmenter la quantité"]')
    await expect(increaseButton).toBeVisible()
    await increaseButton.click()

    // Wait for update
    await page.waitForTimeout(1000)

    // Decrease quantity
    const decreaseButton = page.locator('button[aria-label="Diminuer la quantité"]')
    await decreaseButton.click()
  })

  test('remove item empties the cart', async ({ page }) => {
    await addTestProductToCart(page)

    await openCart(page)

    const removeButton = page.locator('button[aria-label="Retirer du panier"]')
    await expect(removeButton).toBeVisible()
    await removeButton.click()

    const emptyMessage = page.getByText('Votre panier est vide')
    await expect(emptyMessage).toBeVisible({ timeout: 5000 })
  })

  test('proceed to checkout link navigates to /checkout', async ({ page }) => {
    await addTestProductToCart(page)

    await openCart(page)

    const checkoutLink = page.getByRole('link', {
      name: /Finaliser ma commande|Passer à la caisse|Commander/i,
    })
    await expect(checkoutLink).toBeVisible()
    await checkoutLink.click()

    await expect(page).toHaveURL(/\/checkout/)
  })

  test('cart persists after page refresh', async ({ page }) => {
    await addTestProductToCart(page)

    await page.reload()

    await openCart(page)

    const productInCart = page.getByRole('dialog').getByText('Test Product')
    await expect(productInCart).toBeVisible({ timeout: 10000 })
  })
})
