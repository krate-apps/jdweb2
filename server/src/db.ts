import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.js'

let db: DatabaseSync | null = null

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hoster_accounts (
    id INTEGER PRIMARY KEY,
    hoster TEXT NOT NULL,
    username TEXT NOT NULL,
    password_ciphertext BLOB NOT NULL,
    password_iv BLOB NOT NULL,
    password_tag BLOB NOT NULL,
    jd_uuid INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(hoster, username)
  );
  `,
]

export function getDb(): DatabaseSync {
  if (!db) throw new Error('database not initialized')
  return db
}

export function initDb(): DatabaseSync {
  mkdirSync(dirname(config.dbPath), { recursive: true })
  db = new DatabaseSync(config.dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)
  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as unknown as { id: number }[]).map((r) => r.id),
  )
  const insert = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const id = i + 1
    if (applied.has(id)) continue
    const sql = MIGRATIONS[i]
    db.exec('BEGIN')
    try {
      db.exec(sql)
      insert.run(id, Date.now())
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
