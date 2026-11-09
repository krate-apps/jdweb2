/** Runtime public prefix from server-injected meta (preferred) or Vite `base`. */
function runtimeBasePath(): string | null {
  if (typeof document === 'undefined') return null
  const meta = document.querySelector('meta[name="jdweb-base-path"]')
  if (!meta) return null
  return meta.getAttribute('content') ?? ''
}

/** Public URL prefix including trailing slash when non-root. */
export function appBase(): string {
  const runtime = runtimeBasePath()
  const raw = runtime !== null ? runtime : import.meta.env.BASE_URL || '/'
  if (!raw || raw === '/') return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
}

/** Absolute path under the app base, e.g. `api/auth/me`. */
export function apiUrl(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return `${appBase()}${clean}`
}
