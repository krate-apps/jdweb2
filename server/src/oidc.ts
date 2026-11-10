import { createHash, randomBytes } from 'node:crypto'
import { getDb } from './db.js'
import { createUser, findUserByUsername, type PublicUser } from './users.js'

function env(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export function oidcEnabled(): boolean {
  return Boolean(env('JDWEB2_OIDC_ISSUER') && env('JDWEB2_OIDC_CLIENT_ID') && env('JDWEB2_OIDC_REDIRECT_URI'))
}

export function oidcConfig() {
  return {
    issuer: env('JDWEB2_OIDC_ISSUER').replace(/\/+$/, ''),
    clientId: env('JDWEB2_OIDC_CLIENT_ID'),
    clientSecret: env('JDWEB2_OIDC_CLIENT_SECRET'),
    redirectUri: env('JDWEB2_OIDC_REDIRECT_URI'),
    autoProvision: env('JDWEB2_OIDC_AUTO_PROVISION') === '1' || env('JDWEB2_OIDC_AUTO_PROVISION') === 'true',
    usernameClaim: env('JDWEB2_OIDC_USERNAME_CLAIM') || 'preferred_username',
  }
}

type Discovery = {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri?: string
}

let discoveryCache: { at: number; doc: Discovery } | null = null

export async function oidcDiscovery(): Promise<Discovery> {
  const { issuer } = oidcConfig()
  if (!issuer) throw new Error('oidc_not_configured')
  if (discoveryCache && Date.now() - discoveryCache.at < 3600_000) return discoveryCache.doc
  const url = `${issuer}/.well-known/openid-configuration`
  const res = await fetch(url)
  if (!res.ok) throw new Error('oidc_discovery_failed')
  const doc = (await res.json()) as Discovery
  discoveryCache = { at: Date.now(), doc }
  return doc
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function createPkce(): { verifier: string; challenge: string; state: string } {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(24))
  return { verifier, challenge, state }
}

/** Persist PKCE state briefly in SQLite (reuse audit-like table or sessions isn't right — use app_settings temp keys). */
export function storeOidcPending(state: string, verifier: string): void {
  const key = `oidc_pending:${state}`
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, verifier, Date.now())
}

export function takeOidcPending(state: string): string | null {
  const key = `oidc_pending:${state}`
  const row = getDb().prepare('SELECT value, updated_at FROM app_settings WHERE key = ?').get(key) as
    | { value: string; updated_at: number }
    | undefined
  getDb().prepare('DELETE FROM app_settings WHERE key = ?').run(key)
  if (!row) return null
  if (Date.now() - row.updated_at > 600_000) return null
  return row.value
}

export async function buildAuthorizeUrl(): Promise<{ url: string; state: string }> {
  const cfg = oidcConfig()
  const disco = await oidcDiscovery()
  const pkce = createPkce()
  storeOidcPending(pkce.state, pkce.verifier)
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: cfg.redirectUri,
    state: pkce.state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  })
  return { url: `${disco.authorization_endpoint}?${params}`, state: pkce.state }
}

function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.')
  if (parts.length < 2) throw new Error('oidc_invalid_token')
  const json = Buffer.from(parts[1]!, 'base64url').toString('utf8')
  return JSON.parse(json) as Record<string, unknown>
}

const ID_TOKEN_SKEW_SEC = 60

/** Validate iss / aud / exp on a decoded id_token payload (signature still via TLS to IdP). */
export function assertIdTokenClaims(
  claims: Record<string, unknown>,
  expected: { issuer: string; clientId: string },
  nowSec = Math.floor(Date.now() / 1000),
): void {
  if (claims.iss !== expected.issuer) throw new Error('oidc_invalid_token')
  const aud = claims.aud
  const audOk =
    aud === expected.clientId ||
    (Array.isArray(aud) && aud.some((a) => a === expected.clientId))
  if (!audOk) throw new Error('oidc_invalid_token')
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    throw new Error('oidc_invalid_token')
  }
  if (claims.exp + ID_TOKEN_SKEW_SEC < nowSec) throw new Error('oidc_token_expired')
}

export async function exchangeCode(code: string, state: string): Promise<PublicUser> {
  const cfg = oidcConfig()
  const verifier = takeOidcPending(state)
  if (!verifier) throw new Error('oidc_invalid_state')
  const disco = await oidcDiscovery()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: verifier,
  })
  if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret)

  const tokenRes = await fetch(disco.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenRes.ok) throw new Error('oidc_token_failed')
  const tokenJson = (await tokenRes.json()) as { id_token?: string; access_token?: string }
  let claims: Record<string, unknown> = {}
  if (tokenJson.id_token) {
    claims = decodeJwtPayload(tokenJson.id_token)
    assertIdTokenClaims(claims, { issuer: cfg.issuer, clientId: cfg.clientId })
  } else if (tokenJson.access_token && disco.userinfo_endpoint) {
    const ui = await fetch(disco.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    if (!ui.ok) throw new Error('oidc_userinfo_failed')
    claims = (await ui.json()) as Record<string, unknown>
  } else {
    throw new Error('oidc_no_identity')
  }

  const raw =
    claims[cfg.usernameClaim] ??
    claims.preferred_username ??
    claims.email ??
    claims.sub
  const username = String(raw ?? '').trim()
  if (!username) throw new Error('oidc_username_missing')

  let user = findUserByUsername(username)
  if (!user) {
    if (!cfg.autoProvision) throw new Error('oidc_user_unknown')
    // Random unusable local password; SSO-only account.
    const randomPw = randomBytes(24).toString('hex')
    return createUser(username, randomPw)
  }
  return {
    id: user.id,
    username: user.username,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}
