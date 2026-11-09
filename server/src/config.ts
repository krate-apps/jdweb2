import { config as loadEnv } from 'dotenv'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

loadEnv({ path: resolve(fileURLToPath(new URL('../..', import.meta.url)), '.env') })

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Normalize a public path prefix: empty or `/alice/jdweb` (no trailing slash). */
export function normalizeBasePath(raw: string): string {
  let p = raw.trim()
  if (!p || p === '/') return ''
  if (!p.startsWith('/')) p = `/${p}`
  return p.replace(/\/+$/, '')
}

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))

function parseDataKey(raw: string, name: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`${name} must be 64 hex characters (32 bytes)`)
  }
  return Buffer.from(raw, 'hex')
}

/** 32-byte AES key: JDWEB_DATA_KEY (64 hex chars) or derived from session secret in dev. */
function resolveDataKey(): Buffer {
  const raw = env('JDWEB_DATA_KEY')
  if (raw) return parseDataKey(raw, 'JDWEB_DATA_KEY')
  const secret = env('JDWEB_SESSION_SECRET', 'dev-only-change-me')
  console.warn(
    'JDWEB_DATA_KEY is unset; deriving a development key from JDWEB_SESSION_SECRET. Set JDWEB_DATA_KEY in production.',
  )
  return createHash('sha256').update(`jdweb-data-key:${secret}`).digest()
}

function resolvePreviousDataKey(): Buffer | null {
  const raw = env('JDWEB_DATA_KEY_PREVIOUS')
  if (!raw) return null
  return parseDataKey(raw, 'JDWEB_DATA_KEY_PREVIOUS')
}

export const config = {
  host: env('JDWEB_HOST', '127.0.0.1'),
  port: envInt('JDWEB_PORT', 8787),
  basePath: normalizeBasePath(env('JDWEB_BASE_PATH', '')),
  /** Used only to seed the first admin when the users table is empty. */
  seedUser: env('JDWEB_USER', ''),
  seedPassword: env('JDWEB_PASSWORD', ''),
  sessionSecret: env('JDWEB_SESSION_SECRET', 'dev-only-change-me'),
  dbPath: resolve(root, env('JDWEB_DB_PATH', './data/jdweb.sqlite')),
  dataKey: resolveDataKey(),
  /** When set, hoster secrets are re-encrypted from this key to dataKey at boot. */
  dataKeyPrevious: resolvePreviousDataKey(),
  jdApiUrl: env('JD_API_URL', 'http://127.0.0.1:3128').replace(/\/+$/, ''),
  stagingDir: resolve(root, env('JDWEB_STAGING_DIR', './data/staging')),
  moviesDir: resolve(root, env('JDWEB_MOVIES_DIR', './data/library/movies')),
  showsDir: resolve(root, env('JDWEB_SHOWS_DIR', './data/library/shows')),
  otherDir: resolve(root, env('JDWEB_OTHER_DIR', './data/library/other')),
  moverIntervalMs: envInt('JDWEB_MOVER_INTERVAL_MS', 15_000),
  webDist: resolve(root, 'web/dist'),
}
