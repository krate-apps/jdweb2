import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-settings-'))
process.env.JDWEB_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB_SESSION_SECRET = 'test-secret-for-jdweb-settings'
process.env.JDWEB_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JD_API_URL = 'http://127.0.0.1:3128'
process.env.JDWEB_STAGING_DIR = join(root, 'staging')
process.env.JDWEB_MOVIES_DIR = join(root, 'movies')
process.env.JDWEB_SHOWS_DIR = join(root, 'shows')
process.env.JDWEB_OTHER_DIR = join(root, 'other')
process.env.JDWEB_MOVER_INTERVAL_MS = '15000'

const { closeDb, initDb } = await import('./db.js')
const { getAppSettings, initAppSettings, updateAppSettings } = await import('./settings.js')

before(() => {
  initDb()
  initAppSettings()
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('app settings', () => {
  it('seeds from env defaults', () => {
    const s = getAppSettings()
    assert.equal(s.jdApiUrl, 'http://127.0.0.1:3128')
    assert.equal(s.moverIntervalMs, 15000)
    assert.equal(s.stagingDir, process.env.JDWEB_STAGING_DIR)
    assert.ok(s.stagingDir.includes('staging'))
  })

  it('default media root is under ~/medias/jdownloader', async () => {
    const { defaultMediaRoot } = await import('./settings.js')
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    assert.equal(defaultMediaRoot(), join(homedir(), 'medias', 'jdownloader'))
  })

  it('updates and persists JD URL and interval', () => {
    const s = updateAppSettings({
      jdApiUrl: 'http://127.0.0.1:49247',
      moverIntervalMs: 0,
    })
    assert.equal(s.jdApiUrl, 'http://127.0.0.1:49247')
    assert.equal(s.moverIntervalMs, 0)
    assert.equal(getAppSettings().jdApiUrl, 'http://127.0.0.1:49247')
  })

  it('rejects public JD URLs', () => {
    assert.throws(() => updateAppSettings({ jdApiUrl: 'http://1.1.1.1:3128' }), /jd_api_url_not_private/)
  })
})
