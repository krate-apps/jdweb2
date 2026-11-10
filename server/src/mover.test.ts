import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-mover-'))
const stagingMovies = join(root, 'staging', 'movies', 'Dune')
const libraryMovies = join(root, 'movies')
mkdirSync(stagingMovies, { recursive: true })
mkdirSync(libraryMovies, { recursive: true })
writeFileSync(join(stagingMovies, 'movie.mkv'), 'data')

const packages = [
  {
    uuid: 7,
    name: 'Dune',
    saveTo: stagingMovies,
    finished: true,
    status: 'Finished',
    comment: '',
  },
]

const mock = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  let body = ''
  for await (const chunk of req) body += chunk
  const ok = (data: unknown) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data }))
  }
  if (url.pathname === '/jd/version') return ok(1)
  if (url.pathname === '/downloadsV2/queryPackages') return ok(packages)
  if (url.pathname === '/extraction/getArchiveInfo') return ok([])
  if (url.pathname === '/downloadsV2/removeLinks') {
    packages.length = 0
    return ok(null)
  }
  if (url.pathname === '/downloadsV2/setComment') return ok(null)
  res.writeHead(404)
  res.end('{}')
})

await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve))
const { port } = mock.address() as { port: number }

process.env.JDWEB_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB_SESSION_SECRET = 'test-secret-for-jdweb-mover'
process.env.JDWEB_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JD_API_URL = `http://127.0.0.1:${port}`
process.env.JDWEB_STAGING_DIR = join(root, 'staging')
process.env.JDWEB_MOVIES_DIR = libraryMovies
process.env.JDWEB_SHOWS_DIR = join(root, 'shows')
process.env.JDWEB_OTHER_DIR = join(root, 'other')
process.env.JDWEB_MOVER_INTERVAL_MS = '0'

const { closeDb, initDb } = await import('./db.js')
const { initAppSettings } = await import('./settings.js')
const { listMoveEvents } = await import('./move-history.js')
const { runMoverNow, startMover, stopMover } = await import('./mover.js')

before(() => {
  initDb()
  initAppSettings()
})

after(() => {
  stopMover()
  closeDb()
  mock.close()
  rmSync(root, { recursive: true, force: true })
})

describe('runMoverNow', () => {
  it('moves a finished staging package into the library', async () => {
    const result = await runMoverNow()
    assert.equal(result.moved, 1)
    assert.equal(result.failed, 0)
    assert.equal(existsSync(join(libraryMovies, 'Dune', 'movie.mkv')), true)
    assert.equal(existsSync(stagingMovies), false)
    assert.equal(readFileSync(join(libraryMovies, 'Dune', 'movie.mkv'), 'utf8'), 'data')
    const history = listMoveEvents()
    assert.equal(history[0]?.status, 'succeeded')
    assert.equal(history[0]?.packageName, 'Dune')
  })

  it('is a no-op when nothing is finished', async () => {
    const result = await runMoverNow()
    assert.deepEqual(result, { moved: 0, failed: 0 })
  })

  it('startMover respects interval 0', () => {
    startMover()
    stopMover()
  })
})
