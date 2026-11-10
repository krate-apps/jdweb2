import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-library-'))
const movies = join(root, 'movies')
const shows = join(root, 'shows')
const other = join(root, 'other')
mkdirSync(join(movies, 'Dune'), { recursive: true })
mkdirSync(join(shows, 'Show', 'Season 2'), { recursive: true })
mkdirSync(join(other, 'Misc'), { recursive: true })
writeFileSync(join(movies, 'readme.txt'), 'skip')

process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JDWEB2_MOVIES_DIR = movies
process.env.JDWEB2_SHOWS_DIR = shows
process.env.JDWEB2_OTHER_DIR = other

const { initDb, closeDb } = await import('./db.js')
const { initAppSettings } = await import('./settings.js')
const { isLibraryRoot, listLibraryFolders } = await import('./library.js')

initDb()
initAppSettings()

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('listLibraryFolders', () => {
  it('lists immediate directories for each root', async () => {
    assert.deepEqual(await listLibraryFolders('movies'), ['Dune'])
    assert.deepEqual(await listLibraryFolders('shows'), ['Show'])
    assert.deepEqual(await listLibraryFolders('other'), ['Misc'])
    assert.deepEqual(await listLibraryFolders('shows', 'Show'), ['Season 2'])
  })

  it('rejects path traversal outside the root', async () => {
    await assert.rejects(() => listLibraryFolders('movies', '../other'), /invalid_path/)
  })

  it('returns empty for a missing folder', async () => {
    assert.deepEqual(await listLibraryFolders('movies', 'Missing'), [])
  })
})

describe('isLibraryRoot', () => {
  it('accepts known roots only', () => {
    assert.equal(isLibraryRoot('movies'), true)
    assert.equal(isLibraryRoot('shows'), true)
    assert.equal(isLibraryRoot('other'), true)
    assert.equal(isLibraryRoot('staging'), false)
  })
})
