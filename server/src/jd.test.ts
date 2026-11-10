import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-jd-'))
const mock = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/jd/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: 42 }))
    return
  }
  if (url.pathname === '/downloadsV2/queryLinks') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ uuid: 1, name: 'a' }] }))
    return
  }
  if (url.pathname === '/slow') {
    /* never answer — used for timeout */
    return
  }
  res.writeHead(404)
  res.end('{}')
})

await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve))
const { port } = mock.address() as { port: number }

process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-jd'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JD_API_URL = `http://127.0.0.1:${port}`
process.env.JDWEB2_STAGING_DIR = join(root, 'staging')
process.env.JDWEB2_MOVIES_DIR = join(root, 'movies')
process.env.JDWEB2_SHOWS_DIR = join(root, 'shows')
process.env.JDWEB2_OTHER_DIR = join(root, 'other')

const { closeDb, initDb } = await import('./db.js')
const { initAppSettings } = await import('./settings.js')
const { jdCall, probeJdApi, proxyJdRequest, JdError } = await import('./jd.js')

before(() => {
  initDb()
  initAppSettings()
})

after(() => {
  closeDb()
  mock.close()
  rmSync(root, { recursive: true, force: true })
})

describe('probeJdApi', () => {
  it('reports reachable and unreachable APIs', async () => {
    const ok = await probeJdApi(`http://127.0.0.1:${port}`)
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.version, 42)

    const bad = await probeJdApi('http://127.0.0.1:1')
    assert.equal(bad.ok, false)
  })
})

describe('jdCall', () => {
  it('returns data from a healthy JD endpoint', async () => {
    const links = await jdCall<{ uuid: number; name: string }[]>('/downloadsV2/queryLinks', {})
    assert.equal(links[0]?.name, 'a')
  })

  it('wraps unreachable JD as JdError 503', async () => {
    const { updateAppSettings } = await import('./settings.js')
    updateAppSettings({ jdApiUrl: 'http://127.0.0.1:1' })
    await assert.rejects(() => jdCall('/downloadsV2/queryLinks'), (err: unknown) => {
      assert.ok(err instanceof JdError)
      assert.equal(err.status, 503)
      return true
    })
    updateAppSettings({ jdApiUrl: `http://127.0.0.1:${port}` })
  })
})

describe('proxyJdRequest', () => {
  it('forwards successful responses and soft-fails offline', async () => {
    const ok = await proxyJdRequest('/downloadsV2/queryLinks', '{"params":[{}]}')
    assert.equal(ok.status, 200)
    const body = (await ok.json()) as { data: unknown[] }
    assert.ok(Array.isArray(body.data))

    const { updateAppSettings } = await import('./settings.js')
    updateAppSettings({ jdApiUrl: 'http://127.0.0.1:1' })
    const offline = await proxyJdRequest('/downloadsV2/queryLinks', undefined)
    assert.equal(offline.status, 503)
    updateAppSettings({ jdApiUrl: `http://127.0.0.1:${port}` })
  })
})
