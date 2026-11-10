import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-backup-'))
process.env.JDWEB_DB_PATH = join(root, 'live.sqlite')
process.env.JDWEB_SESSION_SECRET = 'test-secret-for-jdweb-backup'
process.env.JDWEB_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const { closeDb, getDb, initDb } = await import('./db.js')
const { restoreBackupBytes } = await import('./backup.js')
const { config } = await import('./config.js')

before(() => {
  initDb()
})

after(() => {
  try {
    closeDb()
  } catch {
    /* already closed by restore */
  }
  rmSync(root, { recursive: true, force: true })
})

describe('restoreBackupBytes', () => {
  it('closes the live handle and replaces the sqlite file', async () => {
    getDb().exec('CREATE TABLE IF NOT EXISTS restore_marker (id INTEGER PRIMARY KEY)')
    getDb().prepare('INSERT INTO restore_marker (id) VALUES (1)').run()

    const donorPath = join(root, 'donor.sqlite')
    const donor = new DatabaseSync(donorPath)
    donor.exec('CREATE TABLE restored_ok (v TEXT)')
    donor.prepare('INSERT INTO restored_ok (v) VALUES (?)').run('yes')
    donor.close()
    const bytes = readFileSync(donorPath)

    await restoreBackupBytes(bytes)

    assert.throws(() => getDb(), /database not initialized/)
    const header = readFileSync(config.dbPath).subarray(0, 16).toString('utf8')
    assert.equal(header, 'SQLite format 3\0')

    const check = new DatabaseSync(config.dbPath, { readOnly: true })
    const row = check.prepare('SELECT v FROM restored_ok').get() as { v: string }
    assert.equal(row.v, 'yes')
    check.close()
  })

  it('rejects non-sqlite uploads', async () => {
    initDb()
    await assert.rejects(() => restoreBackupBytes(Buffer.from('not-sqlite')), /invalid_sqlite/)
    closeDb()
  })
})
