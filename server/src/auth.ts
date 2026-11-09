import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { config } from './config.js'
import { getDb } from './db.js'
import { findUserByUsername } from './users.js'

const COOKIE = 'jdweb_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 14

export interface SessionInfo {
  id: string
  userId: number
  username: string
  createdAt: number
  lastSeenAt: number
  userAgent: string | null
  ip: string | null
}

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')
}

function encodeCookie(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`
}

function decodeCookie(token: string): string | null {
  const [sessionId, sig] = token.split('.')
  if (!sessionId || !sig) return null
  const expected = sign(sessionId)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return sessionId
}

export function issueSession(
  c: Context,
  username: string,
  meta: { userAgent?: string; ip?: string } = {},
): SessionInfo {
  const user = findUserByUsername(username)
  if (!user) throw new Error('user_not_found')
  const id = randomBytes(24).toString('hex')
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, username, created_at, last_seen_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, user.id, user.username, now, now, meta.userAgent ?? null, meta.ip ?? null)
  setCookie(c, COOKIE, encodeCookie(id), {
    httpOnly: true,
    sameSite: 'Lax',
    path: config.basePath || '/',
    maxAge: MAX_AGE_SEC,
    secure: c.req.url.startsWith('https://'),
  })
  return {
    id,
    userId: user.id,
    username: user.username,
    createdAt: now,
    lastSeenAt: now,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  }
}

export function clearSession(c: Context): void {
  const token = getCookie(c, COOKIE)
  if (token) {
    const id = decodeCookie(token)
    if (id) getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }
  deleteCookie(c, COOKIE, { path: config.basePath || '/' })
}

function loadSession(id: string): SessionInfo | null {
  const row = getDb()
    .prepare(
      `SELECT id, user_id, username, created_at, last_seen_at, user_agent, ip
       FROM sessions WHERE id = ?`,
    )
    .get(id) as unknown as
    | {
        id: string
        user_id: number
        username: string
        created_at: number
        last_seen_at: number
        user_agent: string | null
        ip: string | null
      }
    | undefined
  if (!row) return null
  if (Date.now() - row.created_at > MAX_AGE_SEC * 1000) {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return null
  }
  getDb().prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), id)
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    createdAt: row.created_at,
    lastSeenAt: Date.now(),
    userAgent: row.user_agent,
    ip: row.ip,
  }
}

export function readSession(c: Context): SessionInfo | null {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  const id = decodeCookie(token)
  if (!id) return null
  return loadSession(id)
}

export function listSessionsForUser(userId: number): SessionInfo[] {
  const rows = getDb()
    .prepare(
      `SELECT id, user_id, username, created_at, last_seen_at, user_agent, ip
       FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC`,
    )
    .all(userId) as unknown as {
    id: string
    user_id: number
    username: string
    created_at: number
    last_seen_at: number
    user_agent: string | null
    ip: string | null
  }[]
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.user_agent,
    ip: row.ip,
  }))
}

export function revokeSession(id: string, userId: number): boolean {
  const result = getDb().prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, userId)
  return result.changes > 0
}

export function revokeOtherSessions(userId: number, keepId: string): number {
  const result = getDb()
    .prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
    .run(userId, keepId)
  return Number(result.changes)
}

export async function requireAuth(c: Context, next: Next) {
  const session = readSession(c)
  if (!session) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  c.set('username', session.username)
  c.set('sessionId', session.id)
  c.set('userId', session.userId)
  await next()
}

/** CSRF-ish nonce helper for forms that need it later. */
export function newNonce(): string {
  return randomBytes(16).toString('hex')
}
