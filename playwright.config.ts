import { defineConfig } from '@playwright/test'

const port = Number(process.env.JDWEB_PORT || 8787)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node e2e/mock-jd.mjs',
      url: 'http://127.0.0.1:13128/jd/version',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command:
        'JDWEB_HOST=127.0.0.1 JDWEB_PORT=8787 JD_API_URL=http://127.0.0.1:13128 JDWEB_DB_PATH=./data/e2e.sqlite JDWEB_USER=admin JDWEB_PASSWORD=password123 JDWEB_SESSION_SECRET=e2e-session-secret-not-for-prod JDWEB_DATA_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef node server/dist/index.js',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
