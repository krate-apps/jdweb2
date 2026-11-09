import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { argon2id } from '@noble/hashes/argon2.js'
import { config } from './config.js'

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

/** Encrypt a hoster password with AES-256-GCM. */
export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', config.dataKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { ciphertext, iv, tag: cipher.getAuthTag() }
}

export function decryptSecret(parts: EncryptedSecret): string {
  const decipher = createDecipheriv('aes-256-gcm', config.dataKey, parts.iv)
  decipher.setAuthTag(parts.tag)
  return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]).toString('utf8')
}
