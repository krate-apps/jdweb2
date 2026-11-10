import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-crypto-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const { decryptSecret, encryptSecret, hashPassword, verifyPassword } = await import('./crypto.js')

after(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const encoded = await hashPassword('correct-horse')
    assert.match(encoded, /^\$argon2id\$/)
    assert.equal(await verifyPassword(encoded, 'correct-horse'), true)
    assert.equal(await verifyPassword(encoded, 'wrong-password'), false)
  })

  it('rejects malformed encodings', async () => {
    assert.equal(await verifyPassword('not-a-hash', 'x'), false)
  })
})

describe('AES secrets', () => {
  it('round-trips hoster secrets', () => {
    const parts = encryptSecret('premium-pass')
    assert.ok(parts.ciphertext.length > 0)
    assert.equal(decryptSecret(parts), 'premium-pass')
  })
})
