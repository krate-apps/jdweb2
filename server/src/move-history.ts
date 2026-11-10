import { getDb } from './db.js'

export type MoveEventStatus = 'succeeded' | 'failed'

export interface MoveEvent {
  id: number
  packageName: string
  fromPath: string
  toPath: string
  status: MoveEventStatus
  error: string | null
  createdAt: number
}

interface MoveEventRow {
  id: number
  package_name: string
  from_path: string
  to_path: string
  status: string
  error: string | null
  created_at: number
}

function mapRow(row: MoveEventRow): MoveEvent {
  return {
    id: row.id,
    packageName: row.package_name,
    fromPath: row.from_path,
    toPath: row.to_path,
    status: row.status === 'failed' ? 'failed' : 'succeeded',
    error: row.error,
    createdAt: row.created_at,
  }
}

export function recordMoveEvent(input: {
  packageName: string
  fromPath: string
  toPath: string
  status: MoveEventStatus
  error?: string | null
}): void {
  getDb()
    .prepare(
      `INSERT INTO move_events (package_name, from_path, to_path, status, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.packageName,
      input.fromPath,
      input.toPath,
      input.status,
      input.error ?? null,
      Date.now(),
    )
}

export function listMoveEvents(limit = 50): MoveEvent[] {
  const capped = Math.min(Math.max(limit, 1), 200)
  const rows = getDb()
    .prepare(
      `SELECT id, package_name, from_path, to_path, status, error, created_at
       FROM move_events
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(capped) as unknown as MoveEventRow[]
  return rows.map(mapRow)
}
