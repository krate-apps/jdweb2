/** Public URL prefix including trailing slash when non-root (from Vite `base`). */
export function appBase(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

/** Absolute path under the app base, e.g. `api/auth/me`. */
export function apiUrl(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return `${appBase()}${clean}`
}
