import { test, expect } from '@playwright/test'

// Helper: open the cart sheet via the header cart trigger button
async function openCart(page: import('@playwright/test').Page) {
  const cartTrigger = page.locator('button[data-slot="sheet-trigger"]')
  await cartTrigger.click()
}

// Helper: add product to cart and wait for confirmation
async function addTestProductToCart(page: import('@playwright/test').Page) {
  await page.goto('/products/test-product')
  const addToCart = page.locator('button[aria-label="Add to cart"]')
  await expect(addToCart).toBeVisible({ timeout: 10000 })
  await addToCart.click()
  // Toast says "Item added to cart." (with period)
  await expect(page.getByText(/Item added to cart/)).toBeVisible({ timeout: 10000 })
}

test.describe('Cart', () => {
  test('empty cart shows empty message', async ({ page }) => {
    await page.goto('/')
    await openCart(page)

    const emptyMessage = page.getByText('Your cart is empty.')
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
    const increaseButton = page.locator('button[aria-label="Increase item quantity"]')
    await expect(increaseButton).toBeVisible()
    await increaseButton.click()

    // Wait for update
    await page.waitForTimeout(1000)

    // Decrease quantity
    const decreaseButton = page.locator('button[aria-label="Reduce item quantity"]')
    await decreaseButton.click()
  })

  test('remove item empties the cart', async ({ page }) => {
    await addTestProductToCart(page)

    await openCart(page)

    const removeButton = page.locator('button[aria-label="Remove cart item"]')
    await expect(removeButton).toBeVisible()
    await removeButton.click()

    const emptyMessage = page.getByText('Your cart is empty.')
    await expect(emptyMessage).toBeVisible({ timeout: 5000 })
  })

  test('proceed to checkout link navigates to /checkout', async ({ page }) => {
    await addTestProductToCart(page)

    await openCart(page)

    const checkoutLink = page.getByRole('link', { name: /Proceed to Checkout/i })
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
