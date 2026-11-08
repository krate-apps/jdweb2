import { config as loadEnv } from 'dotenv'
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

export const config = {
  host: env('JDWEB_HOST', '127.0.0.1'),
  port: envInt('JDWEB_PORT', 8787),
  basePath: normalizeBasePath(env('JDWEB_BASE_PATH', '')),
  user: env('JDWEB_USER', 'admin'),
  password: env('JDWEB_PASSWORD', 'changeme'),
  sessionSecret: env('JDWEB_SESSION_SECRET', 'dev-only-change-me'),
  jdApiUrl: env('JD_API_URL', 'http://127.0.0.1:3128').replace(/\/+$/, ''),
  stagingDir: resolve(root, env('JDWEB_STAGING_DIR', './data/staging')),
  moviesDir: resolve(root, env('JDWEB_MOVIES_DIR', './data/library/movies')),
  showsDir: resolve(root, env('JDWEB_SHOWS_DIR', './data/library/shows')),
  otherDir: resolve(root, env('JDWEB_OTHER_DIR', './data/library/other')),
  moverIntervalMs: envInt('JDWEB_MOVER_INTERVAL_MS', 15_000),
  webDist: resolve(root, 'web/dist'),
}
