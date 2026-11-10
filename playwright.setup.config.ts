import { defineConfig } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const port = Number(process.env.SETUP_JDWEB2_PORT || 8788)
const jdPort = Number(process.env.SETUP_MOCK_JD_PORT || 13129)
const dataDir = join(tmpdir(), 'jdweb-setup-ui-e2e')
const dbPath = join(dataDir, 'setup-ui.sqlite')

const serverEnv = [
  `JDWEB2_HOST=127.0.0.1`,
  `JDWEB2_PORT=${port}`,
  `JD_API_URL=http://127.0.0.1:${jdPort}`,
  `JDWEB2_DB_PATH=${dbPath}`,
  `JDWEB2_STAGING_DIR=${dataDir}/staging`,
  `JDWEB2_MOVIES_DIR=${dataDir}/movies`,
  `JDWEB2_SHOWS_DIR=${dataDir}/shows`,
  `JDWEB2_OTHER_DIR=${dataDir}/other`,
  `JDWEB2_SESSION_SECRET=e2e-setup-ui-session-secret-not-for-prod`,
  `JDWEB2_DATA_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`,
  // Clear any inherited seed so the wizard stays first-run.
  `JDWEB2_USER=`,
  `JDWEB2_PASSWORD=`,
].join(' ')

export default defineConfig({
  testDir: './e2e',
  testMatch: /setup\.spec\.ts/,
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `sh -c 'mkdir -p "${dataDir}" && rm -f "${dbPath}" "${dbPath}-wal" "${dbPath}-shm" && MOCK_JD_PORT=${jdPort} node e2e/mock-jd.mjs'`,
      url: `http://127.0.0.1:${jdPort}/jd/version`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `sh -c 'mkdir -p "${dataDir}/staging" "${dataDir}/movies" "${dataDir}/shows" "${dataDir}/other" && ${serverEnv} node server/dist/index.js'`,
      url: `http://127.0.0.1:${port}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
