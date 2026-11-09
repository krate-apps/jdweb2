import { getDb } from './db.js'

export function recordAudit(action: string, detail?: string | null, actor?: string | null): void {
  getDb()
    .prepare('INSERT INTO audit_events (at, actor, action, detail) VALUES (?, ?, ?, ?)')
    .run(Date.now(), actor ?? null, action, detail ?? null)
}
