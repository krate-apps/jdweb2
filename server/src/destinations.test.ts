import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-dest-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-dest'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JD_API_URL = 'http://127.0.0.1:3128'
process.env.JDWEB2_STAGING_DIR = join(root, 'staging')
process.env.JDWEB2_MOVIES_DIR = join(root, 'movies')
process.env.JDWEB2_SHOWS_DIR = join(root, 'shows')
process.env.JDWEB2_OTHER_DIR = join(root, 'other')

const { closeDb, initDb } = await import('./db.js')
const { initAppSettings } = await import('./settings.js')
const { describeDestination, libraryPathForStaging, stagingPathFor } = await import('./destinations.js')

before(() => {
  initDb()
  initAppSettings()
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('stagingPathFor', () => {
  it('builds movie show and other staging folders', () => {
    assert.equal(stagingPathFor({ kind: 'movies', title: 'Dune' }), join(root, 'staging', 'movies', 'Dune'))
    assert.equal(
      stagingPathFor({ kind: 'shows', title: 'Show', season: 2 }),
      join(root, 'staging', 'shows', 'Show', 'Season 2'),
    )
    assert.equal(
      stagingPathFor({ kind: 'other', title: 'pack' }),
      join(root, 'staging', 'downloads', 'pack'),
    )
  })

  it('sanitizes unsafe title characters and defaults season', () => {
    const path = stagingPathFor({ kind: 'movies', title: 'A/B<>C' })
    assert.equal(path, join(root, 'staging', 'movies', 'A - BC'))
    assert.equal(
      stagingPathFor({ kind: 'shows', title: 'Show' }),
      join(root, 'staging', 'shows', 'Show', 'Season 1'),
    )
  })
})

describe('libraryPathForStaging', () => {
  it('maps staging trees to library roots', () => {
    assert.equal(
      libraryPathForStaging(join(root, 'staging', 'movies', 'Dune')),
      join(root, 'movies', 'Dune'),
    )
    assert.equal(
      libraryPathForStaging(join(root, 'staging', 'shows', 'Show', 'Season 1')),
      join(root, 'shows', 'Show', 'Season 1'),
    )
    assert.equal(
      libraryPathForStaging(join(root, 'staging', 'downloads', 'pack')),
      join(root, 'other', 'pack'),
    )
  })

  it('returns null outside staging or incomplete paths', () => {
    assert.equal(libraryPathForStaging(join(root, 'elsewhere', 'x')), null)
    assert.equal(libraryPathForStaging(join(root, 'staging', 'movies')), null)
  })
})

describe('describeDestination', () => {
  it('labels known staging destinations', () => {
    assert.equal(describeDestination(join(root, 'staging', 'movies', 'Dune')), 'Movies / Dune')
    assert.equal(
      describeDestination(join(root, 'staging', 'shows', 'Show', 'Season 1')),
      'Series / Show / Season 1',
    )
    assert.equal(describeDestination(join(root, 'staging', 'downloads', 'pack')), 'Other / pack')
  })

  it('returns null for unknown paths', () => {
    assert.equal(describeDestination(join(root, 'staging')), null)
    assert.equal(describeDestination('/tmp/nope'), null)
  })
})
