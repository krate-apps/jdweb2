import { config } from './config.js'

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
  const url = `${config.jdApiUrl}${path.startsWith('/') ? path : `/${path}`}`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params }),
    })
  } catch (err) {
    throw new JdError(503, err instanceof Error ? err.message : 'JDownloader unreachable')
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new JdError(response.status, text || response.statusText)
  }
  const body = (await response.json()) as { data: T }
  return body.data
}

export async function proxyJdRequest(path: string, rawBody: string | undefined): Promise<Response> {
  const url = `${config.jdApiUrl}${path.startsWith('/') ? path : `/${path}`}`
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody && rawBody.length > 0 ? rawBody : '{"params":[]}',
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unreachable'
    return new Response(
      JSON.stringify({
        error: 'jdownloader_unreachable',
        detail,
        jdApiUrl: config.jdApiUrl,
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
