import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { getDb } from './db.js'
import { projectRoot } from './config.js'
import { assertSafeJdApiUrl } from './security.js'

export interface AppSettings {
  jdApiUrl: string
  stagingDir: string
  moviesDir: string
  showsDir: string
  otherDir: string
  moverIntervalMs: number
}

export type AppSettingsPatch = Partial<AppSettings>

const KEYS = [
  'jdApiUrl',
  'stagingDir',
  'moviesDir',
  'showsDir',
  'otherDir',
  'moverIntervalMs',
] as const

type SettingKey = (typeof KEYS)[number]

let current: AppSettings | null = null

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Default media tree: ~/medias/jdownloader/… (same home layout as other downloaders). */
export function defaultMediaRoot(): string {
  return join(homedir(), 'medias', 'jdownloader')
}

function resolveSettingPath(raw: string, fallbackAbsolute: string): string {
  const value = raw.trim()
  if (!value) return fallbackAbsolute
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) return resolve(value)
  return resolve(projectRoot, value)
}

/** Defaults from env (legacy installs) or ~/medias/jdownloader like other downloaders. */
export function defaultsFromEnv(): AppSettings {
  const media = defaultMediaRoot()
  return {
    jdApiUrl: env('JD_API_URL', 'http://127.0.0.1:3128').replace(/\/+$/, ''),
    stagingDir: resolveSettingPath(env('JDWEB_STAGING_DIR'), join(media, 'staging')),
    moviesDir: resolveSettingPath(env('JDWEB_MOVIES_DIR'), join(media, 'library', 'movies')),
    showsDir: resolveSettingPath(env('JDWEB_SHOWS_DIR'), join(media, 'library', 'shows')),
    otherDir: resolveSettingPath(env('JDWEB_OTHER_DIR'), join(media, 'library', 'other')),
    moverIntervalMs: envInt('JDWEB_MOVER_INTERVAL_MS', 15_000),
  }
}

function readRow(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function writeRow(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, Date.now())
}

function serialize(key: SettingKey, settings: AppSettings): string {
  if (key === 'moverIntervalMs') return String(settings.moverIntervalMs)
  return settings[key]
}

function parseStored(defaults: AppSettings): AppSettings {
  const out: AppSettings = { ...defaults }
  for (const key of KEYS) {
    const raw = readRow(key)
    if (raw == null) continue
    if (key === 'moverIntervalMs') {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) out.moverIntervalMs = n
    } else if (key === 'jdApiUrl') {
      out.jdApiUrl = raw.replace(/\/+$/, '')
    } else {
      out[key] = resolve(raw)
    }
  }
  return out
}

/** Load settings from SQLite; seed missing keys from env defaults. */
export function initAppSettings(): AppSettings {
  const defaults = defaultsFromEnv()
  const count = (getDb().prepare('SELECT COUNT(*) AS n FROM app_settings').get() as { n: number }).n
  if (count === 0) {
    for (const key of KEYS) {
      writeRow(key, serialize(key, defaults))
    }
    current = { ...defaults }
    return current
  }
  current = parseStored(defaults)
  // Ensure every key exists (partial upgrades)
  for (const key of KEYS) {
    if (readRow(key) == null) writeRow(key, serialize(key, current))
  }
  return current
}

export function getAppSettings(): AppSettings {
  if (!current) throw new Error('app settings not initialized')
  return current
}

export function resolvePathInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('path_required')
  return resolve(trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed) ? trimmed : resolve(projectRoot, trimmed))
}

export function updateAppSettings(patch: AppSettingsPatch): AppSettings {
  const next: AppSettings = { ...getAppSettings() }
  if (patch.jdApiUrl !== undefined) {
    next.jdApiUrl = assertSafeJdApiUrl(patch.jdApiUrl)
  }
  if (patch.stagingDir !== undefined) next.stagingDir = resolvePathInput(patch.stagingDir)
  if (patch.moviesDir !== undefined) next.moviesDir = resolvePathInput(patch.moviesDir)
  if (patch.showsDir !== undefined) next.showsDir = resolvePathInput(patch.showsDir)
  if (patch.otherDir !== undefined) next.otherDir = resolvePathInput(patch.otherDir)
  if (patch.moverIntervalMs !== undefined) {
    const n = Number(patch.moverIntervalMs)
    if (!Number.isFinite(n) || n < 0) throw new Error('invalid_mover_interval')
    next.moverIntervalMs = Math.floor(n)
  }
  for (const key of KEYS) {
    writeRow(key, serialize(key, next))
  }
  current = next
  return current
}
