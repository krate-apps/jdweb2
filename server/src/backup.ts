import { copyFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { config } from './config.js'
import { getDb } from './db.js'
import { log } from './log.js'

/** Checkpoint WAL and copy the sqlite file to a temp path; returns absolute path. */
export async function createBackupFile(destDir: string): Promise<{ path: string; filename: string }> {
  await mkdir(destDir, { recursive: true })
  const db = getDb()
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch (err) {
    log('warn', 'wal checkpoint failed', { error: err instanceof Error ? err.message : String(err) })
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `jdweb-backup-${stamp}.sqlite`
  const dest = join(destDir, filename)
  await copyFile(config.dbPath, dest)
  return { path: dest, filename }
}

/** Validate uploaded bytes look like SQLite and atomically replace the live DB path (caller should restart). */
export async function restoreBackupBytes(bytes: Buffer): Promise<void> {
  if (bytes.length < 16 || bytes.subarray(0, 16).toString('utf8') !== 'SQLite format 3\0') {
    throw new Error('invalid_sqlite')
  }
  const dir = dirname(config.dbPath)
  await mkdir(dir, { recursive: true })
  const staging = join(dir, `.restore-${Date.now()}.sqlite`)
  await writeFile(staging, bytes)
  const bak = join(dir, `${basename(config.dbPath)}.pre-restore`)
  try {
    await copyFile(config.dbPath, bak)
  } catch {
    /* first install */
  }
  await rename(staging, config.dbPath)
  // Drop sidecar WAL/SHM so the restored file is authoritative after restart.
  for (const side of [`${config.dbPath}-wal`, `${config.dbPath}-shm`]) {
    try {
      await unlink(side)
    } catch {
      /* ignore */
    }
  }
}
