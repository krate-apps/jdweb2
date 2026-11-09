import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { argon2id } from '@noble/hashes/argon2.js'
import { config } from './config.js'
import { getDb } from './db.js'

const ARGON2_OPTS = { t: 3, m: 65_536, p: 1, dkLen: 32 } as const

function b64(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64url')
}

function fromB64(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

/** Hash a login password with argon2id (PHC string). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = argon2id(password, salt, ARGON2_OPTS)
  return `$argon2id$v=19$m=${ARGON2_OPTS.m},t=${ARGON2_OPTS.t},p=${ARGON2_OPTS.p}$${b64(salt)}$${b64(hash)}`
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(encoded)
  if (!match) return false
  const m = Number(match[1])
  const t = Number(match[2])
  const p = Number(match[3])
  const salt = fromB64(match[4])
  const expected = fromB64(match[5])
  const actual = Buffer.from(argon2id(password, salt, { t, m, p, dkLen: expected.length }))
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export interface EncryptedSecret {
  ciphertext: Buffer
  iv: Buffer
  tag: Buffer
}

function encryptWithKey(plaintext: string, key: Buffer): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { ciphertext, iv, tag: cipher.getAuthTag() }
}

function decryptWithKey(parts: EncryptedSecret, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, parts.iv)
  decipher.setAuthTag(parts.tag)
  return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]).toString('utf8')
}

/** Encrypt a hoster password with AES-256-GCM. */
export function encryptSecret(plaintext: string): EncryptedSecret {
  return encryptWithKey(plaintext, config.dataKey)
}

export function decryptSecret(parts: EncryptedSecret): string {
  return decryptWithKey(parts, config.dataKey)
}

/** Re-encrypt every hoster secret from JDWEB_DATA_KEY_PREVIOUS to JDWEB_DATA_KEY. */
export function rotateHosterSecrets(): number {
  const previous = config.dataKeyPrevious
  if (!previous) return 0
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, password_ciphertext, password_iv, password_tag
       FROM hoster_accounts
       WHERE password_ciphertext IS NOT NULL AND password_iv IS NOT NULL AND password_tag IS NOT NULL`,
    )
    .all() as unknown as {
    id: number
    password_ciphertext: Buffer
    password_iv: Buffer
    password_tag: Buffer
  }[]
  const update = db.prepare(
    `UPDATE hoster_accounts
     SET password_ciphertext = ?, password_iv = ?, password_tag = ?, updated_at = ?
     WHERE id = ?`,
  )
  let count = 0
  db.exec('BEGIN')
  try {
    for (const row of rows) {
      const plaintext = decryptWithKey(
        { ciphertext: row.password_ciphertext, iv: row.password_iv, tag: row.password_tag },
        previous,
      )
      const enc = encryptWithKey(plaintext, config.dataKey)
      update.run(enc.ciphertext, enc.iv, enc.tag, Date.now(), row.id)
      count++
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return count
}
