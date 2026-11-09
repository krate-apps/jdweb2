import { getDb } from './db.js'
import { decryptSecret, encryptSecret } from './crypto.js'
import { jdCall } from './jd.js'

export interface HosterRow {
  id: number
  hoster: string
  username: string
  password_ciphertext: Buffer | null
  password_iv: Buffer | null
  password_tag: Buffer | null
  jd_uuid: number | null
  enabled: number
  created_at: number
  updated_at: number
}

export interface HosterPublic {
  id: number
  hoster: string
  username: string
  enabled: boolean
  jdUuid: number | null
  needsSecret: boolean
  createdAt: number
  updatedAt: number
  valid?: boolean
  status?: string
  errorString?: string
  trafficLeft?: number
  trafficMax?: number
}

interface JdAccount {
  uuid: number
  hostname: string
  username: string
  enabled: boolean
  valid?: boolean
  errorString?: string
  trafficLeft?: number
  trafficMax?: number
  status?: string
}

function hasSecret(row: HosterRow): boolean {
  return Boolean(row.password_ciphertext && row.password_iv && row.password_tag)
}

function toPublic(row: HosterRow, jd?: JdAccount): HosterPublic {
  return {
    id: row.id,
    hoster: row.hoster,
    username: row.username,
    enabled: Boolean(row.enabled),
    jdUuid: row.jd_uuid,
    needsSecret: !hasSecret(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    valid: jd?.valid,
    status: jd?.status,
    errorString: jd?.errorString,
    trafficLeft: jd?.trafficLeft,
    trafficMax: jd?.trafficMax,
  }
}

function plaintextOf(row: HosterRow): string {
  if (!hasSecret(row)) throw new Error('password_required')
  return decryptSecret({
    ciphertext: row.password_ciphertext!,
    iv: row.password_iv!,
    tag: row.password_tag!,
  })
}

async function listJdAccounts(): Promise<JdAccount[]> {
  try {
    return (
      (await jdCall<JdAccount[]>('/accountsV2/listAccounts', {
        username: true,
        hostname: true,
        enabled: true,
        valid: true,
        errorString: true,
        trafficLeft: true,
        trafficMax: true,
        status: true,
      })) ?? []
    )
  } catch {
    return []
  }
}

export function countHosters(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM hoster_accounts').get() as { n: number }).n
}

export async function listHosters(): Promise<HosterPublic[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, hoster, username, password_ciphertext, password_iv, password_tag,
              jd_uuid, enabled, created_at, updated_at
       FROM hoster_accounts ORDER BY hoster, username`,
    )
    .all() as unknown as HosterRow[]
  const jdAccounts = await listJdAccounts()
  const byUuid = new Map(jdAccounts.map((a) => [a.uuid, a]))
  return rows.map((row) => toPublic(row, row.jd_uuid != null ? byUuid.get(row.jd_uuid) : undefined))
}

function findById(id: number): HosterRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, hoster, username, password_ciphertext, password_iv, password_tag,
              jd_uuid, enabled, created_at, updated_at
       FROM hoster_accounts WHERE id = ?`,
    )
    .get(id) as unknown as HosterRow | undefined
  return row ?? null
}

async function resolveJdUuid(hoster: string, username: string): Promise<number | null> {
  const accounts = await listJdAccounts()
  const match = accounts.find(
    (a) =>
      a.hostname.toLowerCase() === hoster.toLowerCase() &&
      a.username.toLowerCase() === username.toLowerCase(),
  )
  return match?.uuid ?? null
}

export async function createHoster(input: {
  hoster: string
  username: string
  password: string
  enabled?: boolean
}): Promise<HosterPublic> {
  const hoster = input.hoster.trim()
  const username = input.username.trim()
  if (!hoster || !username || !input.password) throw new Error('hoster_username_password_required')

  const enc = encryptSecret(input.password)
  const now = Date.now()
  const enabled = input.enabled === false ? 0 : 1

  let id: number
  try {
    const result = getDb()
      .prepare(
        `INSERT INTO hoster_accounts
          (hoster, username, password_ciphertext, password_iv, password_tag, jd_uuid, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      )
      .run(hoster, username, enc.ciphertext, enc.iv, enc.tag, enabled, now, now)
    id = Number(result.lastInsertRowid)
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) throw new Error('hoster_exists')
    throw err
  }

  await jdCall('/accountsV2/addAccount', hoster, username, input.password)
  const jdUuid = await resolveJdUuid(hoster, username)
  if (jdUuid != null) {
    getDb().prepare('UPDATE hoster_accounts SET jd_uuid = ?, updated_at = ? WHERE id = ?').run(jdUuid, Date.now(), id)
    if (!enabled) await jdCall('/accountsV2/disableAccounts', [jdUuid])
  }

  const row = findById(id)!
  const jdAccounts = await listJdAccounts()
  const jd = row.jd_uuid != null ? jdAccounts.find((a) => a.uuid === row.jd_uuid) : undefined
  return toPublic(row, jd)
}

/** Import JD accounts missing from SQLite (secrets must be filled later). */
export async function importHostersFromJd(): Promise<{ imported: number; skipped: number; hosters: HosterPublic[] }> {
  const jdAccounts = await listJdAccounts()
  const existing = getDb()
    .prepare('SELECT hoster, username, jd_uuid FROM hoster_accounts')
    .all() as unknown as { hoster: string; username: string; jd_uuid: number | null }[]
  const byKey = new Set(existing.map((e) => `${e.hoster.toLowerCase()}::${e.username.toLowerCase()}`))
  const byUuid = new Set(existing.map((e) => e.jd_uuid).filter((u): u is number => u != null))

  let imported = 0
  let skipped = 0
  const now = Date.now()
  const insert = getDb().prepare(
    `INSERT INTO hoster_accounts
      (hoster, username, password_ciphertext, password_iv, password_tag, jd_uuid, enabled, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
  )

  for (const acc of jdAccounts) {
    const key = `${acc.hostname.toLowerCase()}::${acc.username.toLowerCase()}`
    if (byKey.has(key) || byUuid.has(acc.uuid)) {
      skipped++
      continue
    }
    insert.run(acc.hostname, acc.username, acc.uuid, acc.enabled ? 1 : 0, now, now)
    byKey.add(key)
    byUuid.add(acc.uuid)
    imported++
  }

  return { imported, skipped, hosters: await listHosters() }
}

export async function setHosterEnabled(id: number, enabled: boolean): Promise<HosterPublic> {
  const row = findById(id)
  if (!row) throw new Error('hoster_not_found')
  getDb()
    .prepare('UPDATE hoster_accounts SET enabled = ?, updated_at = ? WHERE id = ?')
    .run(enabled ? 1 : 0, Date.now(), id)
  if (row.jd_uuid != null) {
    if (enabled) await jdCall('/accountsV2/enableAccounts', [row.jd_uuid])
    else await jdCall('/accountsV2/disableAccounts', [row.jd_uuid])
  }
  return (await listHosters()).find((h) => h.id === id)!
}

export async function updateHosterPassword(id: number, password: string): Promise<HosterPublic> {
  const row = findById(id)
  if (!row) throw new Error('hoster_not_found')
  if (!password) throw new Error('password_required')

  const enc = encryptSecret(password)
  getDb()
    .prepare(
      `UPDATE hoster_accounts
       SET password_ciphertext = ?, password_iv = ?, password_tag = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(enc.ciphertext, enc.iv, enc.tag, Date.now(), id)

  if (row.jd_uuid != null) {
    try {
      await jdCall('/accountsV2/removeAccounts', [row.jd_uuid])
    } catch {
      /* ignore */
    }
  }
  await jdCall('/accountsV2/addAccount', row.hoster, row.username, password)
  const jdUuid = await resolveJdUuid(row.hoster, row.username)
  getDb()
    .prepare('UPDATE hoster_accounts SET jd_uuid = ?, updated_at = ? WHERE id = ?')
    .run(jdUuid, Date.now(), id)
  if (!row.enabled && jdUuid != null) {
    await jdCall('/accountsV2/disableAccounts', [jdUuid])
  }
  return (await listHosters()).find((h) => h.id === id)!
}

export async function deleteHoster(id: number): Promise<void> {
  const row = findById(id)
  if (!row) throw new Error('hoster_not_found')
  if (row.jd_uuid != null) {
    try {
      await jdCall('/accountsV2/removeAccounts', [row.jd_uuid])
    } catch {
      /* JD may already have removed it */
    }
  }
  getDb().prepare('DELETE FROM hoster_accounts WHERE id = ?').run(id)
}

export async function refreshHosters(): Promise<HosterPublic[]> {
  const rows = getDb().prepare('SELECT jd_uuid FROM hoster_accounts WHERE jd_uuid IS NOT NULL').all() as unknown as {
    jd_uuid: number
  }[]
  const ids = rows.map((r) => r.jd_uuid)
  if (ids.length) await jdCall('/accountsV2/refreshAccounts', ids)
  return listHosters()
}

/** Re-push a stored hoster to JD (e.g. after JD wipe). */
export async function resyncHoster(id: number): Promise<HosterPublic> {
  const row = findById(id)
  if (!row) throw new Error('hoster_not_found')
  const password = plaintextOf(row)
  if (row.jd_uuid != null) {
    try {
      await jdCall('/accountsV2/removeAccounts', [row.jd_uuid])
    } catch {
      /* ignore */
    }
  }
  await jdCall('/accountsV2/addAccount', row.hoster, row.username, password)
  const jdUuid = await resolveJdUuid(row.hoster, row.username)
  getDb()
    .prepare('UPDATE hoster_accounts SET jd_uuid = ?, updated_at = ? WHERE id = ?')
    .run(jdUuid, Date.now(), id)
  if (!row.enabled && jdUuid != null) {
    await jdCall('/accountsV2/disableAccounts', [jdUuid])
  }
  return (await listHosters()).find((h) => h.id === id)!
}
