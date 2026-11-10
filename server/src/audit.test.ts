import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-audit-'))
process.env.JDWEB_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB_SESSION_SECRET = 'test-secret-for-jdweb-audit'
process.env.JDWEB_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const { closeDb, getDb, initDb } = await import('./db.js')
const { recordAudit } = await import('./audit.js')

before(() => {
  initDb()
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('recordAudit', () => {
  it('inserts audit rows with actor and detail', () => {
    recordAudit('auth.login_ok', 'admin', 'admin')
    recordAudit('settings.update', null, null)
    const rows = getDb()
      .prepare('SELECT actor, action, detail FROM audit_events ORDER BY id')
      .all() as { actor: string | null; action: string; detail: string | null }[]
    assert.equal(rows.length, 2)
    assert.equal(rows[0].action, 'auth.login_ok')
    assert.equal(rows[0].actor, 'admin')
    assert.equal(rows[0].detail, 'admin')
    assert.equal(rows[1].action, 'settings.update')
    assert.equal(rows[1].actor, null)
  })
})
