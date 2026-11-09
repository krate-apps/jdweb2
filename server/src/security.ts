import { isIP } from 'node:net'

/** Docker Desktop / Compose hostnames that resolve to the host or gateway (not public SSRF). */
const DOCKER_HOST_NAMES = new Set(['host.docker.internal', 'gateway.docker.internal'])

/** True for loopback or RFC1918 / link-local private hosts. */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) return true
  if (DOCKER_HOST_NAMES.has(host)) return true
  const ipVersion = isIP(host)
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number)
    if (parts[0] === 127) return true
    if (parts[0] === 10) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 169 && parts[1] === 254) return true
    return false
  }
  if (ipVersion === 6) {
    if (host === '::1') return true
    if (host.startsWith('fc') || host.startsWith('fd')) return true // ULA
    if (host.startsWith('fe80')) return true
    return false
  }
  // Hostnames other than localhost: reject (SSRF to internal DNS names)
  return false
}

export function assertSafeJdApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('invalid_jd_api_url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('invalid_jd_api_url')
  }
  if (url.username || url.password) throw new Error('invalid_jd_api_url')
  if (!isPrivateOrLoopbackHost(url.hostname)) throw new Error('jd_api_url_not_private')
  return trimmed
}
