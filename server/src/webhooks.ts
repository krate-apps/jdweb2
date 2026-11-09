import { config } from './config.js'
import { getDb } from './db.js'

export const WEBHOOK_EVENTS = ['download.finished', 'mover.succeeded', 'mover.failed'] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export interface WebhookRow {
  id: number
  url: string
  events: WebhookEvent[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

interface DbRow {
  id: number
  url: string
  events: string
  enabled: number
  created_at: number
  updated_at: number
}

export interface WebhookPayload {
  event: WebhookEvent
  at: string
  package: { uuid?: number; name: string; saveTo?: string }
  error?: string
}

let failureCount = 0

export function webhookFailureCount(): number {
  return failureCount
}

function parseEvents(raw: string): WebhookEvent[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...WEBHOOK_EVENTS]
    return parsed.filter((e): e is WebhookEvent =>
      typeof e === 'string' && (WEBHOOK_EVENTS as readonly string[]).includes(e),
    )
  } catch {
    return [...WEBHOOK_EVENTS]
  }
}

function mapRow(row: DbRow): WebhookRow {
  return {
    id: row.id,
    url: row.url,
    events: parseEvents(row.events),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function seedWebhooksFromEnv(): number {
  if (config.webhookUrls.length === 0) return 0
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) AS n FROM webhooks').get() as { n: number }).n
  if (count > 0) return 0
  const now = Date.now()
  const events = JSON.stringify([...WEBHOOK_EVENTS])
  const insert = db.prepare(
    `INSERT INTO webhooks (url, events, enabled, created_at, updated_at) VALUES (?, ?, 1, ?, ?)`,
  )
  let seeded = 0
  for (const url of config.webhookUrls) {
    insert.run(url, events, now, now)
    seeded += 1
  }
  return seeded
}

export function listWebhooks(): WebhookRow[] {
  const rows = getDb()
    .prepare('SELECT id, url, events, enabled, created_at, updated_at FROM webhooks ORDER BY id')
    .all() as unknown as DbRow[]
  return rows.map(mapRow)
}

export function createWebhook(url: string, events: WebhookEvent[], enabled = true): WebhookRow {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('invalid_url')
  const selected = events.length ? events : [...WEBHOOK_EVENTS]
  const now = Date.now()
  const result = getDb()
    .prepare(
      `INSERT INTO webhooks (url, events, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(trimmed, JSON.stringify(selected), enabled ? 1 : 0, now, now)
  return getWebhook(Number(result.lastInsertRowid))!
}

export function updateWebhook(
  id: number,
  patch: { url?: string; events?: WebhookEvent[]; enabled?: boolean },
): WebhookRow | null {
  const existing = getWebhook(id)
  if (!existing) return null
  const url = patch.url?.trim() ?? existing.url
  if (!/^https?:\/\//i.test(url)) throw new Error('invalid_url')
  const events = patch.events ?? existing.events
  const enabled = patch.enabled ?? existing.enabled
  getDb()
    .prepare(
      `UPDATE webhooks SET url = ?, events = ?, enabled = ?, updated_at = ? WHERE id = ?`,
    )
    .run(url, JSON.stringify(events), enabled ? 1 : 0, Date.now(), id)
  return getWebhook(id)
}

export function deleteWebhook(id: number): boolean {
  const result = getDb().prepare('DELETE FROM webhooks WHERE id = ?').run(id)
  return Number(result.changes) > 0
}

export function getWebhook(id: number): WebhookRow | null {
  const row = getDb()
    .prepare('SELECT id, url, events, enabled, created_at, updated_at FROM webhooks WHERE id = ?')
    .get(id) as unknown as DbRow | undefined
  return row ? mapRow(row) : null
}

export function countWebhooks(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM webhooks').get() as { n: number }).n
}

/** Fire matching webhooks; never throws. */
export async function dispatchWebhook(payload: WebhookPayload): Promise<void> {
  const hooks = listWebhooks().filter((h) => h.enabled && h.events.includes(payload.event))
  await Promise.all(
    hooks.map(async (hook) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5_000)
      try {
        const res = await fetch(hook.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        if (!res.ok) {
          failureCount += 1
          console.warn(`[webhook] ${hook.url} returned ${res.status}`)
        }
      } catch (err) {
        failureCount += 1
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[webhook] ${hook.url} failed: ${message}`)
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}
