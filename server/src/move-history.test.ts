import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-moves-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-moves'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const { closeDb, initDb } = await import('./db.js')
const { listMoveEvents, recordMoveEvent } = await import('./move-history.js')

before(() => {
  initDb()
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('move history', () => {
  it('records events newest-first and caps the limit', () => {
    recordMoveEvent({
      packageName: 'a',
      fromPath: '/from/a',
      toPath: '/to/a',
      status: 'succeeded',
    })
    recordMoveEvent({
      packageName: 'b',
      fromPath: '/from/b',
      toPath: '/to/b',
      status: 'failed',
      error: 'boom',
    })

    const all = listMoveEvents(50)
    assert.equal(all.length, 2)
    assert.equal(all[0].packageName, 'b')
    assert.equal(all[0].status, 'failed')
    assert.equal(all[0].error, 'boom')
    assert.equal(all[1].packageName, 'a')
    assert.equal(all[1].status, 'succeeded')

    assert.equal(listMoveEvents(1).length, 1)
    assert.equal(listMoveEvents(0).length, 1)
    assert.equal(listMoveEvents(999).length, 2)
  })
})
