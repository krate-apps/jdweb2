import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-users-'))
process.env.JDWEB_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB_SESSION_SECRET = 'test-secret-for-jdweb'
process.env.JDWEB_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.JDWEB_USER = 'seedadmin'
process.env.JDWEB_PASSWORD = 'seed-password-ok'

const { closeDb, initDb } = await import('./db.js')
const {
  changeOwnPassword,
  countUsers,
  createUser,
  seedAdminFromEnv,
  verifyLogin,
} = await import('./users.js')

before(() => {
  initDb()
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('users', () => {
  it('seeds the first admin from env when empty', async () => {
    assert.equal(countUsers(), 0)
    await seedAdminFromEnv()
    assert.equal(countUsers(), 1)
    const user = await verifyLogin('seedadmin', 'seed-password-ok')
    assert.ok(user)
    assert.equal(user.username, 'seedadmin')
    await seedAdminFromEnv()
    assert.equal(countUsers(), 1)
  })

  it('creates users and rejects short passwords', async () => {
    const created = await createUser('alice', 'password-long')
    assert.equal(created.username, 'alice')
    await assert.rejects(() => createUser('bob', 'short'), /password_too_short/)
    await assert.rejects(() => createUser('alice', 'another-password'), /username_taken/)
  })

  it('changes password after verifying the current one', async () => {
    await changeOwnPassword('alice', 'password-long', 'password-newer')
    assert.equal(await verifyLogin('alice', 'password-long'), null)
    assert.ok(await verifyLogin('alice', 'password-newer'))
    await assert.rejects(
      () => changeOwnPassword('alice', 'wrong', 'password-other'),
      /invalid_credentials/,
    )
  })
})
