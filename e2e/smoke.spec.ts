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
  // Mobile + desktop both render the empty copy; only one is visible per viewport.
  await expect(
    page.locator('p:visible').filter({ hasText: /Nothing here yet|Rien pour le moment/i }),
  ).toBeVisible({ timeout: 15_000 })
})

test('bad credentials stay on login', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[autocomplete="username"]').fill('admin')
  await page.locator('input[autocomplete="current-password"]').fill('wrong-password')
  await page.getByRole('button', { name: /sign in|se connecter/i }).click()
  await expect(page).toHaveURL(/login/)
  await expect(page.getByText(/invalid username or password|identifiants incorrects/i)).toBeVisible({
    timeout: 10_000,
  })
})

test('unauthenticated downloads redirect to login', async ({ page }) => {
  await page.goto('/downloads')
  await expect(page).toHaveURL(/login/, { timeout: 15_000 })
})

test('settings page loads', async ({ page }) => {
  await login(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: /settings|réglages/i })).toBeVisible()
})

test('grabber and accounts pages load', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: /link grabber|collecteur/i }).click()
  await expect(page).toHaveURL(/grabber/)
  await expect(page.getByRole('heading', { name: /link grabber|collecteur de liens/i })).toBeVisible()

  await page.getByRole('link', { name: /accounts|comptes/i }).first().click()
  await expect(page).toHaveURL(/accounts/)
  await expect(page.getByRole('heading', { name: /premium accounts|comptes premium/i })).toBeVisible()
})

test('logout returns to login', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: /log out|déconnexion/i }).click()
  await expect(page).toHaveURL(/login/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /sign in|connexion/i })).toBeVisible()
})
