import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const accounts: {
  uuid: number
  hostname: string
  username: string
  enabled: boolean
  valid?: boolean
  status?: string
}[] = []
let nextUuid = 100

const mock = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  let body = ''
  for await (const chunk of req) body += chunk
  const json = () => {
    try {
      return JSON.parse(body || '{}') as { params?: unknown[] }
    } catch {
      return { params: [] }
    }
  }
  const ok = (data: unknown) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data }))
  }

  if (url.pathname === '/jd/version') return ok(1)
  if (url.pathname === '/accountsV2/listAccounts') return ok(accounts)
  if (url.pathname === '/accountsV2/addAccount') {
    const [hostname, username] = (json().params ?? []) as string[]
    const existing = accounts.find(
      (a) => a.hostname === hostname && a.username === username,
    )
    if (!existing) {
      accounts.push({
        uuid: nextUuid++,
        hostname,
        username,
        enabled: true,
        valid: true,
        status: 'VALID',
      })
    }
    return ok(null)
  }
  if (url.pathname === '/accountsV2/removeAccounts') {
    const [ids] = (json().params ?? []) as number[][]
    for (const id of ids ?? []) {
      const idx = accounts.findIndex((a) => a.uuid === id)
      if (idx >= 0) accounts.splice(idx, 1)
    }
    return ok(null)
  }
  if (url.pathname === '/accountsV2/enableAccounts' || url.pathname === '/accountsV2/disableAccounts') {
    const [ids] = (json().params ?? []) as number[][]
    const enabled = url.pathname.includes('enable')
    for (const id of ids ?? []) {
      const acc = accounts.find((a) => a.uuid === id)
      if (acc) acc.enabled = enabled
    }
    return ok(null)
  }
  if (url.pathname === '/accountsV2/refreshAccounts') return ok(null)
  res.writeHead(404)
  res.end('{}')
})

await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve))
const { port } = mock.address() as { port: number }

const root = mkdtempSync(join(tmpdir(), 'jdweb-hosters-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-hosters'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JD_API_URL = `http://127.0.0.1:${port}`
process.env.JDWEB2_STAGING_DIR = join(root, 'staging')
process.env.JDWEB2_MOVIES_DIR = join(root, 'movies')
process.env.JDWEB2_SHOWS_DIR = join(root, 'shows')
process.env.JDWEB2_OTHER_DIR = join(root, 'other')

const { closeDb, initDb } = await import('./db.js')
const { initAppSettings } = await import('./settings.js')
const {
  countHosters,
  createHoster,
  deleteHoster,
  importHostersFromJd,
  listHosters,
  setHosterEnabled,
  updateHosterPassword,
} = await import('./hosters.js')

before(() => {
  initDb()
  initAppSettings()
})

after(() => {
  closeDb()
  mock.close()
  rmSync(root, { recursive: true, force: true })
})

describe('hosters', () => {
  it('validates create input', async () => {
    await assert.rejects(
      () => createHoster({ hoster: '', username: 'u', password: 'p' }),
      /hoster_username_password_required/,
    )
  })

  it('creates lists enables and deletes a hoster via JD', async () => {
    assert.equal(countHosters(), 0)
    const created = await createHoster({
      hoster: 'rapidgator.net',
      username: 'user@example.com',
      password: 'secret-pass',
    })
    assert.equal(created.hoster, 'rapidgator.net')
    assert.equal(created.needsSecret, false)
    assert.ok(created.jdUuid != null)
    assert.equal(countHosters(), 1)

    await assert.rejects(
      () =>
        createHoster({
          hoster: 'rapidgator.net',
          username: 'user@example.com',
          password: 'other',
        }),
      /hoster_exists/,
    )

    const disabled = await setHosterEnabled(created.id, false)
    assert.equal(disabled.enabled, false)
    assert.equal(accounts.find((a) => a.uuid === created.jdUuid!)?.enabled, false)

    const updated = await updateHosterPassword(created.id, 'new-secret-pass')
    assert.equal(updated.needsSecret, false)

    await deleteHoster(created.id)
    assert.equal(countHosters(), 0)
    assert.equal((await listHosters()).length, 0)
  })

  it('imports JD accounts missing from sqlite', async () => {
    accounts.push({
      uuid: 999,
      hostname: 'uploaded.net',
      username: 'import-me',
      enabled: true,
    })
    const result = await importHostersFromJd()
    assert.equal(result.imported, 1)
    assert.ok(result.hosters.some((h) => h.username === 'import-me' && h.needsSecret))
    const again = await importHostersFromJd()
    assert.equal(again.imported, 0)
    assert.ok(again.skipped >= 1)
    const imported = result.hosters.find((h) => h.username === 'import-me')!
    await deleteHoster(imported.id)
  })
})
