import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-staging-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-staging'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JD_API_URL = 'http://127.0.0.1:3128'
process.env.JDWEB2_STAGING_DIR = join(root, 'staging')
process.env.JDWEB2_MOVIES_DIR = join(root, 'movies')
process.env.JDWEB2_SHOWS_DIR = join(root, 'shows')
process.env.JDWEB2_OTHER_DIR = join(root, 'other')

const { closeDb, initDb } = await import('./db.js')
const { initAppSettings } = await import('./settings.js')
const { deleteStaging, listStaging, resolveStagingPath } = await import('./staging.js')

before(() => {
  initDb()
  initAppSettings()
  mkdirSync(join(root, 'staging', 'movies'), { recursive: true })
  writeFileSync(join(root, 'staging', 'note.txt'), 'hello')
  mkdirSync(join(root, 'staging', 'movies', 'Dune'), { recursive: true })
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('resolveStagingPath', () => {
  it('resolves under staging and rejects traversal', () => {
    assert.equal(resolveStagingPath('movies'), join(root, 'staging', 'movies'))
    assert.throws(() => resolveStagingPath('../movies'), /invalid_path/)
    assert.throws(() => resolveStagingPath('movies/../../etc'), /invalid_path/)
  })
})

describe('listStaging', () => {
  it('lists dirs before files and skips missing roots', async () => {
    const entries = await listStaging()
    assert.ok(entries.some((e) => e.name === 'movies' && e.kind === 'dir'))
    assert.ok(entries.some((e) => e.name === 'note.txt' && e.kind === 'file'))
    assert.deepEqual(
      entries.map((e) => e.name),
      [...entries].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }).map((e) => e.name),
    )
    assert.deepEqual(await listStaging('missing'), [])
  })
})

describe('deleteStaging', () => {
  it('deletes nested entries but not the root', async () => {
    writeFileSync(join(root, 'staging', 'gone.txt'), 'x')
    await deleteStaging('gone.txt')
    assert.equal((await listStaging()).some((e) => e.name === 'gone.txt'), false)
    await assert.rejects(() => deleteStaging(''), /invalid_path/)
    await assert.rejects(() => deleteStaging('.'), /cannot_delete_root|invalid_path/)
  })
})
