import { test, expect } from '@playwright/test'
import { CUSTOMER_AUTH_FILE } from './fixtures/test-data'

test.describe('Rewards Landing Page', () => {
  test('page renders with hero heading', async ({ page }) => {
    await page.goto('/rewards')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toContainText('Your Journey to Glass Skin Starts Here')
  })

  test('tier cards are displayed', async ({ page }) => {
    await page.goto('/rewards')

    // Tier names appear as headings in the tier cards section
    await expect(page.getByRole('heading', { name: 'Starter' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Glowing' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Radiant' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Glass Skin', exact: true })).toBeVisible()
  })

  test('referral code input is visible', async ({ page }) => {
    await page.goto('/rewards')

    const referralInput = page.getByPlaceholder('Referral code (optional)')
    await expect(referralInput).toBeVisible()
  })

  test('join button is visible when not logged in', async ({ page }) => {
    await page.goto('/rewards')

    const joinButton = page.getByRole('button', { name: /Sign Up & Join/i })
    await expect(joinButton).toBeVisible()
  })

  test('FAQ section renders with questions', async ({ page }) => {
    await page.goto('/rewards')

    // FAQ section has accordion items — look for common FAQ text
    const faqText = page.getByText(/How do I join/i)
    await expect(faqText).toBeVisible()
  })

  test('earn ways section is visible', async ({ page }) => {
    await page.goto('/rewards')

    await expect(page.getByText('Ways to Earn Points')).toBeVisible()
  })
})

test.describe('Rewards Landing (logged in)', () => {
  test.use({ storageState: CUSTOMER_AUTH_FILE })

  test('shows join or rewards link for logged in user', async ({ page }) => {
    await page.goto('/rewards')

    // Logged-in user should see either "Sign Up & Join" / "Join Now" or "Go to My Rewards"
    const joinButton = page.getByRole('button', { name: /Sign Up|Join Now/i }).first()
    const alreadyMember = page.getByRole('link', { name: /Go to My Rewards/i })

    const joinVisible = await joinButton.isVisible().catch(() => false)
    const memberVisible = await alreadyMember.isVisible().catch(() => false)

    expect(joinVisible || memberVisible).toBe(true)
  })
})
