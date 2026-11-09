import { apiUrl } from '@/lib/base'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, body?.error ?? response.statusText)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function errorMessageFromBody(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string }
    if (parsed?.error) return parsed.error
  } catch {
    /* plain text */
  }
  const trimmed = raw.trim()
  return trimmed || fallback
}

/** Call JDownloader through the authenticated jdweb proxy. */
export async function jdCall<T>(jdPath: string, ...params: unknown[]): Promise<T> {
  const path = jdPath.startsWith('/') ? jdPath : `/${jdPath}`
  const response = await fetch(apiUrl(`api/jd${path}`), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params }),
  })
  if (!response.ok) {
    const raw = await response.text()
    const detail = errorMessageFromBody(raw, response.statusText)
    const offline = response.status === 503 || /fetch failed|unreachable|ECONNREFUSED/i.test(detail)
    throw new ApiError(response.status, offline ? 'jdownloader_unreachable' : detail)
  }
  const body = (await response.json()) as { data: T }
  return body.data
}
