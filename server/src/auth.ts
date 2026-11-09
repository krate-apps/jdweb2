import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { config } from './config.js'

const COOKIE = 'jdweb_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 14

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')
}

function encodeSession(username: string): string {
  const body = Buffer.from(JSON.stringify({ u: username, t: Date.now() }), 'utf8').toString('base64url')
  return `${body}.${sign(body)}`
}

function decodeSession(token: string): { username: string } | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u?: string; t?: number }
    if (!data.u || typeof data.t !== 'number') return null
    if (Date.now() - data.t > MAX_AGE_SEC * 1000) return null
    return { username: data.u }
  } catch {
    return null
  }
}

export function issueSession(c: Context, username: string): void {
  setCookie(c, COOKIE, encodeSession(username), {
    httpOnly: true,
    sameSite: 'Lax',
    path: config.basePath || '/',
    maxAge: MAX_AGE_SEC,
    secure: c.req.url.startsWith('https://'),
  })
}

export function clearSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: config.basePath || '/' })
}

export function readSession(c: Context): { username: string } | null {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  return decodeSession(token)
}

export async function requireAuth(c: Context, next: Next) {
  const session = readSession(c)
  if (!session) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  c.set('username', session.username)
  await next()
}

/** CSRF-ish nonce helper for forms that need it later. */
export function newNonce(): string {
  return randomBytes(16).toString('hex')
}
