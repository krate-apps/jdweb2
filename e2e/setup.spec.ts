import { test, expect } from '@playwright/test'

const jdPort = Number(process.env.SETUP_MOCK_JD_PORT || 13129)

test.describe.configure({ mode: 'serial' })

test('unconfigured app redirects to first-run setup', async ({ page }) => {
  const health = await page.request.get('/api/health')
  expect(health.ok()).toBeTruthy()
  expect((await health.json()).needsSetup).toBe(true)

  await page.goto('/login')
  await expect(page).toHaveURL(/setup/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /first-run setup|configuration initiale/i })).toBeVisible()
  await expect(page.getByText(/step 1 of 3|étape 1 sur 3/i)).toBeVisible()
})

test('short password is rejected on setup step 1', async ({ page }) => {
  await page.goto('/setup')
  await page.locator('input[autocomplete="username"]').fill('setupadmin')
  // Bypass HTML minlength so the API error path is exercised.
  await page.locator('input[autocomplete="new-password"]').evaluate((el) => {
    el.removeAttribute('minlength')
  })
  await page.locator('input[autocomplete="new-password"]').fill('short')
  await page.getByRole('button', { name: /create admin|créer/i }).click()
  await expect(page.getByText(/password must be at least 8|mot de passe doit contenir/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/step 1 of 3|étape 1 sur 3/i)).toBeVisible()
})

test('setup wizard creates admin configures jd and opens downloads', async ({ page }) => {
  await page.goto('/setup')
  await expect(page.getByRole('heading', { name: /first-run setup|configuration initiale/i })).toBeVisible()

  await page.locator('input[autocomplete="username"]').fill('setupadmin')
  await page.locator('input[autocomplete="new-password"]').fill('password123')
  await page.getByRole('button', { name: /create admin|créer/i }).click()

  await expect(page.getByText(/step 2 of 3|étape 2 sur 3/i)).toBeVisible({ timeout: 15_000 })
  await page.locator('input.font-mono').first().fill(`http://127.0.0.1:${jdPort}`)
  await page.getByRole('button', { name: /continue|continuer/i }).click()

  await expect(page.getByText(/step 3 of 3|étape 3 sur 3/i)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /finish and open jdweb|terminer et ouvrir jdweb/i }).click()

  await expect(page).toHaveURL(/downloads/, { timeout: 15_000 })
  await expect(
    page.locator('p:visible').filter({ hasText: /Nothing here yet|Rien pour le moment/i }),
  ).toBeVisible({ timeout: 15_000 })
})

test('setup route redirects to login once complete', async ({ page }) => {
  await page.goto('/setup')
  await expect(page).toHaveURL(/login/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /sign in|connexion/i })).toBeVisible()

  const status = await page.request.get('/api/setup/status')
  expect((await status.json()).needsSetup).toBe(false)
})
