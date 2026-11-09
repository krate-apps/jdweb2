import { getDb } from './db.js'
import { hashPassword, verifyPassword } from './crypto.js'
import { config } from './config.js'
import { log } from './log.js'

export interface UserRow {
  id: number
  username: string
  password_hash: string
  created_at: number
  updated_at: number
}

export interface PublicUser {
  id: number
  username: string
  createdAt: number
  updatedAt: number
}

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as unknown as { n: number }
  return row.n
}

export function listUsers(): PublicUser[] {
  const rows = getDb()
    .prepare('SELECT id, username, password_hash, created_at, updated_at FROM users ORDER BY username')
    .all() as unknown as UserRow[]
  return rows.map(toPublic)
}

export function findUserByUsername(username: string): UserRow | null {
  const row = getDb()
    .prepare('SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ? COLLATE NOCASE')
    .get(username) as unknown as UserRow | undefined
  return row ?? null
}

export async function createUser(username: string, password: string): Promise<PublicUser> {
  const trimmed = username.trim()
  if (!trimmed || !password) throw new Error('username_and_password_required')
  if (password.length < 8) throw new Error('password_too_short')
  const now = Date.now()
  const passwordHash = await hashPassword(password)
  try {
    const result = getDb()
      .prepare(
        'INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(trimmed, passwordHash, now, now)
    return {
      id: Number(result.lastInsertRowid),
      username: trimmed,
      createdAt: now,
      updatedAt: now,
    }
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) throw new Error('username_taken')
    throw err
  }
}

export async function verifyLogin(username: string, password: string): Promise<PublicUser | null> {
  const row = findUserByUsername(username)
  if (!row) {
    await hashPassword(password) // constant-ish work on miss
    return null
  }
  const ok = await verifyPassword(row.password_hash, password)
  return ok ? toPublic(row) : null
}

export async function updateUserPassword(id: number, password: string): Promise<void> {
  if (password.length < 8) throw new Error('password_too_short')
  const passwordHash = await hashPassword(password)
  const result = getDb()
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(passwordHash, Date.now(), id)
  if (result.changes === 0) throw new Error('user_not_found')
}

export async function changeOwnPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await verifyLogin(username, currentPassword)
  if (!user) throw new Error('invalid_credentials')
  await updateUserPassword(user.id, newPassword)
}

export function deleteUser(id: number): void {
  if (countUsers() <= 1) throw new Error('cannot_delete_last_user')
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('user_not_found')
}

/** Create the first admin from env when the users table is empty. */
export async function seedAdminFromEnv(): Promise<boolean> {
  if (countUsers() > 0) return false
  if (!config.seedUser || !config.seedPassword) return false
  await createUser(config.seedUser, config.seedPassword)
  log('info', 'seeded admin from env', { username: config.seedUser })
  return true
}
