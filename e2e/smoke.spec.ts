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

test('settings page loads connection section', async ({ page }) => {
  await login(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: /settings|réglages/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /jdownloader and library|jdownloader et bibliothèque/i })).toBeVisible()
})

test('settings notifications and users sections open', async ({ page }) => {
  await login(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: /notifications|notifications/i }).click()
  await expect(page.getByRole('heading', { name: /webhook/i })).toBeVisible()
  await page.getByRole('button', { name: /users|utilisateurs/i }).click()
  await expect(page.getByText(/admin/i).first()).toBeVisible()
})

test('grabber and accounts pages load', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: /link grabber|collecteur/i }).click()
  await expect(page).toHaveURL(/grabber/)
  await expect(page.getByRole('heading', { name: /link grabber|collecteur de liens/i })).toBeVisible()
  await expect(page.getByText(/no links waiting|aucun lien en attente/i)).toBeVisible()

  await page.getByRole('link', { name: /accounts|comptes/i }).first().click()
  await expect(page).toHaveURL(/accounts/)
  await expect(page.getByRole('heading', { name: /premium accounts|comptes premium/i })).toBeVisible()
})

test('add links modal opens from grabber', async ({ page }) => {
  await login(page)
  await page.goto('/grabber')
  await page.getByRole('main').getByRole('button', { name: /add links|ajouter des liens/i }).click()
  await expect(page.getByRole('heading', { name: /add links|ajouter des liens/i })).toBeVisible()
  await page.getByRole('button', { name: /cancel|annuler/i }).click()
  await expect(page.getByRole('heading', { name: /add links|ajouter des liens/i })).toHaveCount(0)
})

test('theme toggle flips data-theme', async ({ page }) => {
  await page.goto('/login')
  const before = await page.locator('html').getAttribute('data-theme')
  await page.getByRole('button', { name: /dark|light|sombre|clair/i }).click()
  const after = await page.locator('html').getAttribute('data-theme')
  expect(after).toBeTruthy()
  expect(after).not.toEqual(before)
})

test('language switch updates login title', async ({ page }) => {
  await page.goto('/login')
  await page.locator('select').selectOption('fr')
  await expect(page.getByRole('heading', { name: /connexion à jdweb/i })).toBeVisible()
  await page.locator('select').selectOption('en')
  await expect(page.getByRole('heading', { name: /sign in to jdweb/i })).toBeVisible()
})

test('mobile bottom nav reaches settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.locator('nav[aria-label="jdweb"]').getByRole('link', { name: /settings|réglages/i }).click()
  await expect(page).toHaveURL(/settings/)
  await expect(page.getByRole('heading', { name: /settings|réglages/i })).toBeVisible()
})

test('logout returns to login', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: /log out|déconnexion/i }).click()
  await expect(page).toHaveURL(/login/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /sign in|connexion/i })).toBeVisible()
})
