import { getAppSettings } from './settings.js'
import { log } from './log.js'
import { noteJdError } from './metrics.js'

export class JdError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'JdError'
  }
}

/**
 * Call JDownloader's local HTTP API.
 * Methods take positional params as POST `{"params":[...]}` and return `{data:...}`.
 */
export async function jdCall<T>(path: string, ...params: unknown[]): Promise<T> {
  const jdApiUrl = getAppSettings().jdApiUrl
  const url = `${jdApiUrl}${path.startsWith('/') ? path : `/${path}`}`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params }),
      signal: AbortSignal.timeout(4000),
    })
  } catch (err) {
    noteJdError()
    const message = err instanceof Error ? err.message : 'JDownloader unreachable'
    log('error', 'jd call failed', { path, error: message })
    throw new JdError(503, message)
  }
  if (!response.ok) {
    noteJdError()
    const text = await response.text().catch(() => '')
    log('error', 'jd call non-ok', { path, status: response.status })
    throw new JdError(response.status, text || response.statusText)
  }
  const body = (await response.json()) as { data: T }
  return body.data
}

export async function proxyJdRequest(path: string, rawBody: string | undefined): Promise<Response> {
  const jdApiUrl = getAppSettings().jdApiUrl
  const url = `${jdApiUrl}${path.startsWith('/') ? path : `/${path}`}`
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody && rawBody.length > 0 ? rawBody : '{"params":[]}',
      signal: AbortSignal.timeout(4000),
    })
  } catch (err) {
    noteJdError()
    const detail = err instanceof Error ? err.message : 'unreachable'
    log('error', 'jd proxy failed', { path, error: detail })
    return new Response(
      JSON.stringify({
        error: 'jdownloader_unreachable',
        detail,
        jdApiUrl,
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/** Probe JD local API; returns version data or null. */
export async function probeJdApi(url = getAppSettings().jdApiUrl): Promise<{ ok: true; version: unknown } | { ok: false; error: string }> {
  const target = `${url.replace(/\/+$/, '')}/jd/version`
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"params":[]}',
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) return { ok: false, error: `http_${response.status}` }
    const body = (await response.json()) as { data?: unknown }
    return { ok: true, version: body.data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unreachable' }
  }
}
