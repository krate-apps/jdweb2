import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('input[autocomplete="username"]').fill('admin')
  await page.locator('input[autocomplete="current-password"]').fill('password123')
  await page.getByRole('button', { name: /sign in|se connecter/i }).click()
  await expect(page).toHaveURL(/downloads/, { timeout: 15_000 })
}

test('login opens downloads', async ({ page }) => {
  await login(page)
  await expect(page.getByText(/nothing|rien/i).first()).toBeVisible({ timeout: 15_000 })
})

test('settings page loads', async ({ page }) => {
  await login(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: /settings|réglages/i })).toBeVisible()
})
