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
    throw new ApiError(response.status, await response.text())
  }
  const body = (await response.json()) as { data: T }
  return body.data
}
