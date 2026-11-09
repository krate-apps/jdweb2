import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { getMimeType } from 'hono/utils/mime'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { access, mkdir, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { assertProductionSecrets, config } from './config.js'
import {
  clearSession,
  issueSession,
  listSessionsForUser,
  readSession,
  requireAuth,
  revokeOtherSessions,
  revokeSession,
} from './auth.js'
import { proxyJdRequest, probeJdApi } from './jd.js'
import { describeDestination, stagingPathFor, type DestinationKind } from './destinations.js'
import { movePackageNow, restartMover, runMoverNow, startMover } from './mover.js'
import { listMoveEvents } from './move-history.js'
import { initDb } from './db.js'
import {
  basePathForcedByEnv,
  getAppSettings,
  getBasePath,
  initAppSettings,
  updateAppSettings,
} from './settings.js'
import { assertSafeJdApiUrl } from './security.js'
import { rateLimitAllow } from './rate-limit.js'
import { recordAudit } from './audit.js'
import {
  countUsers,
  changeOwnPassword,
  createUser,
  deleteUser,
  listUsers,
  seedAdminFromEnv,
  updateUserPassword,
  verifyLogin,
} from './users.js'
import {
  countHosters,
  createHoster,
  deleteHoster,
  importHostersFromJd,
  listHosters,
  refreshHosters,
  resyncHoster,
  setHosterEnabled,
  updateHosterPassword,
} from './hosters.js'
import { isLibraryRoot, listLibraryFolders } from './library.js'
import { rotateHosterSecrets } from './crypto.js'
import {
  WEBHOOK_EVENTS,
  countWebhooks,
  createWebhook,
  deleteWebhook,
  dispatchWebhook,
  listWebhooks,
  seedWebhooksFromEnv,
  updateWebhook,
  webhookFailureCount,
  type WebhookEvent,
} from './webhooks.js'
import { log } from './log.js'
import { metricsText, noteAuthLogin, snapshotMetrics } from './metrics.js'
import { addEventsClient, removeEventsClient, sendEventsSnapshot } from './events.js'
import { buildAuthorizeUrl, exchangeCode, oidcEnabled } from './oidc.js'
import { deleteStaging, listStaging } from './staging.js'
import { createBackupFile, restoreBackupBytes } from './backup.js'
import { tmpdir } from 'node:os'
import { readFile as readFileFs, unlink } from 'node:fs/promises'

type Vars = { username: string; sessionId: string; userId: number }

const app = new Hono<{ Variables: Vars }>()

function clientIp(c: Parameters<typeof getConnInfo>[0]): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  try {
    return getConnInfo(c).remote.address ?? ''
  } catch {
    return ''
  }
}

function isLoopback(c: Parameters<typeof getConnInfo>[0]): boolean {
  const remote = clientIp(c)
  return (
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote === '::ffff:127.0.0.1' ||
    remote === 'localhost'
  )
}

function sessionMeta(c: Parameters<typeof getConnInfo>[0]) {
  return {
    userAgent: c.req.header('user-agent') ?? undefined,
    ip: clientIp(c) || undefined,
  }
}

function errorStatus(message: string): ContentfulStatusCode {
  switch (message) {
    case 'invalid_credentials':
      return 401
    case 'setup_already_done':
    case 'username_taken':
    case 'hoster_exists':
    case 'cannot_delete_last_user':
      return 409
    case 'user_not_found':
    case 'hoster_not_found':
      return 404
    case 'username_and_password_required':
    case 'hoster_username_password_required':
    case 'password_required':
    case 'password_too_short':
    case 'kind_and_title_required':
    case 'invalid_body':
    case 'invalid_jd_api_url':
    case 'jd_api_url_not_private':
    case 'invalid_mover_interval':
    case 'invalid_path':
    case 'cannot_delete_root':
    case 'path_required':
    case 'file_required':
    case 'invalid_sqlite':
    case 'invalid_base_path':
    case 'path_required':
      return 400
    case 'setup_localhost_only':
      return 403
    case 'rate_limited':
      return 429
    default:
      return 500
  }
}

app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
  c.header('X-Frame-Options', 'DENY')
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  )
  await next()
})

app.get('/api/health', async (c) => {
  const settings = getAppSettings()
  const jd = await probeJdApi(settings.jdApiUrl)
  let uiBuilt = false
  try {
    await access(join(config.webDist, 'index.html'), constants.R_OK)
    uiBuilt = true
  } catch {
    uiBuilt = false
  }
  return c.json({
    ok: true,
    version: config.version,
    basePath: settings.basePath || '/',
    mover: settings.moverIntervalMs > 0,
    needsSetup: countUsers() === 0,
    jdReachable: jd.ok,
    jdApiUrl: settings.jdApiUrl,
    uiBuilt,
    settingsReady: true,
  })
})

app.get('/api/setup/status', (c) => c.json({ needsSetup: countUsers() === 0 }))

app.post('/api/setup/admin', async (c) => {
  if (countUsers() > 0) return c.json({ error: 'setup_already_done' }, 403)
  if (!isLoopback(c)) return c.json({ error: 'setup_localhost_only' }, 403)
  const ip = clientIp(c) || 'loopback'
  if (!rateLimitAllow(`setup:${ip}`, 10, 60_000)) return c.json({ error: 'rate_limited' }, 429)
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  try {
    const user = await createUser(body?.username ?? '', body?.password ?? '')
    issueSession(c, user.username, sessionMeta(c))
    recordAudit('setup.admin', user.username, user.username)
    return c.json({ username: user.username })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'setup_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

const JD_PROBE_PORTS = [3128, 49247, 3129, 8080]

app.post('/api/setup/probe-jd', async (c) => {
  const session = readSession(c)
  if (countUsers() === 0 && !isLoopback(c)) return c.json({ error: 'setup_localhost_only' }, 403)
  if (countUsers() > 0 && !session) return c.json({ error: 'unauthorized' }, 401)
  const body = (await c.req.json().catch(() => null)) as { url?: string } | null
  if (body?.url?.trim()) {
    try {
      const url = assertSafeJdApiUrl(body.url)
      return c.json(await probeJdApi(url))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid_jd_api_url'
      return c.json({ error: message }, errorStatus(message))
    }
  }
  const found: { url: string; version: unknown }[] = []
  for (const port of JD_PROBE_PORTS) {
    const url = `http://127.0.0.1:${port}`
    const result = await probeJdApi(url)
    if (result.ok) found.push({ url, version: result.version })
  }
  return c.json({ candidates: found })
})

app.get('/api/auth/oidc/status', (c) => c.json({ enabled: oidcEnabled() }))

app.get('/api/auth/oidc/start', async (c) => {
  if (!oidcEnabled()) return c.json({ error: 'oidc_not_configured' }, 404)
  try {
    const { url } = await buildAuthorizeUrl()
    return c.redirect(url)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oidc_start_failed'
    return c.json({ error: message }, 502)
  }
})

app.get('/api/auth/oidc/callback', async (c) => {
  if (!oidcEnabled()) return c.json({ error: 'oidc_not_configured' }, 404)
  const code = c.req.query('code')
  const state = c.req.query('state')
  const oauthError = c.req.query('error')
  const base = getBasePath()
  const loginPath = `${base || ''}/login`
  if (oauthError || !code || !state) {
    return c.redirect(`${loginPath}?error=oidc`)
  }
  try {
    const user = await exchangeCode(code, state)
    const info = getConnInfo(c)
    issueSession(c, user.username, {
      userAgent: c.req.header('user-agent') ?? undefined,
      ip: info.remote.address,
    })
    recordAudit('auth.oidc_ok', user.username, user.username)
    noteAuthLogin(true)
    return c.redirect(`${base || ''}/downloads`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oidc_failed'
    recordAudit('auth.oidc_failed', message)
    noteAuthLogin(false)
    return c.redirect(`${loginPath}?error=${encodeURIComponent(message)}`)
  }
})

app.post('/api/auth/login', async (c) => {
  if (countUsers() === 0) return c.json({ error: 'needs_setup' }, 503)
  const ip = clientIp(c) || 'unknown'
  if (!rateLimitAllow(`login:${ip}`, 20, 60_000)) {
    recordAudit('auth.login_rate_limited', ip)
    return c.json({ error: 'rate_limited' }, 429)
  }
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  const user = await verifyLogin(body?.username ?? '', body?.password ?? '')
  if (!user) {
    noteAuthLogin(false)
    recordAudit('auth.login_failed', body?.username?.trim() || null)
    log('warn', 'auth login failed', { username: body?.username?.trim() || null })
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  noteAuthLogin(true)
  recordAudit('auth.login_ok', user.username, user.username)
  log('info', 'auth login ok', { username: user.username })
  issueSession(c, user.username, sessionMeta(c))
  return c.json({ username: user.username })
})

app.post('/api/auth/logout', (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

app.get('/api/auth/me', (c) => {
  const session = readSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ username: session.username })
})

app.get('/api/sessions', requireAuth, (c) => {
  const currentId = c.get('sessionId')
  const sessions = listSessionsForUser(c.get('userId')).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    userAgent: s.userAgent,
    ip: s.ip,
    current: s.id === currentId,
  }))
  return c.json({ sessions })
})

app.delete('/api/sessions/:id', requireAuth, (c) => {
  const id = c.req.param('id') ?? ''
  if (!id || !revokeSession(id, c.get('userId'))) return c.json({ error: 'session_not_found' }, 404)
  if (id === c.get('sessionId')) clearSession(c)
  return c.json({ ok: true })
})

app.delete('/api/sessions', requireAuth, (c) => {
  const removed = revokeOtherSessions(c.get('userId'), c.get('sessionId'))
  return c.json({ ok: true, removed })
})

app.get('/api/users', requireAuth, (c) => c.json({ users: listUsers() }))

app.post('/api/users/me/password', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    currentPassword?: string
    newPassword?: string
  } | null
  try {
    await changeOwnPassword(
      c.get('username'),
      body?.currentPassword ?? '',
      body?.newPassword ?? '',
    )
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.post('/api/users', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  try {
    const user = await createUser(body?.username ?? '', body?.password ?? '')
    return c.json(user, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.patch('/api/users/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  const body = (await c.req.json().catch(() => null)) as { password?: string } | null
  try {
    await updateUserPassword(id, body?.password ?? '')
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.delete('/api/users/:id', requireAuth, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  try {
    deleteUser(id)
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.get('/api/hosters', requireAuth, async (c) => {
  try {
    return c.json({ hosters: await listHosters() })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'list_failed' }, 500)
  }
})

app.post('/api/hosters', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    hoster?: string
    username?: string
    password?: string
    enabled?: boolean
  } | null
  try {
    const hoster = await createHoster({
      hoster: body?.hoster ?? '',
      username: body?.username ?? '',
      password: body?.password ?? '',
      enabled: body?.enabled,
    })
    return c.json(hoster, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.patch('/api/hosters/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  const body = (await c.req.json().catch(() => null)) as {
    enabled?: boolean
    password?: string
  } | null
  try {
    if (typeof body?.password === 'string' && body.password.length > 0) {
      const hoster = await updateHosterPassword(id, body.password)
      recordAudit('hoster.password_change', String(id), c.get('username'))
      return c.json(hoster)
    }
    if (typeof body?.enabled === 'boolean') {
      return c.json(await setHosterEnabled(id, body.enabled))
    }
    return c.json({ error: 'invalid_body' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.delete('/api/hosters/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  try {
    await deleteHoster(id)
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.post('/api/hosters/refresh', requireAuth, async (c) => {
  try {
    return c.json({ hosters: await refreshHosters() })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'refresh_failed' }, 500)
  }
})

app.post('/api/hosters/import', requireAuth, async (c) => {
  try {
    return c.json(await importHostersFromJd())
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'import_failed' }, 500)
  }
})

app.post('/api/hosters/:id/resync', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  try {
    return c.json(await resyncHoster(id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'resync_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.get('/api/config/public', requireAuth, (c) => {
  const s = getAppSettings()
  return c.json({
    version: config.version,
    basePath: s.basePath || '/',
    basePathForcedByEnv: basePathForcedByEnv(),
    stagingDir: s.stagingDir,
    moviesDir: s.moviesDir,
    showsDir: s.showsDir,
    otherDir: s.otherDir,
    moverEnabled: s.moverIntervalMs > 0,
    moverIntervalMs: s.moverIntervalMs,
    jdApiUrl: s.jdApiUrl,
    oidcEnabled: oidcEnabled(),
  })
})

app.get('/api/events', requireAuth, (c) => {
  return streamSSE(c, async (stream) => {
    const write = async (event: string, data: unknown) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) })
    }
    const client = addEventsClient(write)
    try {
      await sendEventsSnapshot(write)
      while (!stream.closed && !stream.aborted) {
        await stream.writeSSE({ event: 'heartbeat', data: '{}' })
        await stream.sleep(15_000)
      }
    } finally {
      removeEventsClient(client)
    }
  })
})

app.get('/api/settings', requireAuth, (c) =>
  c.json({ settings: getAppSettings(), basePathForcedByEnv: basePathForcedByEnv() }),
)

app.patch('/api/settings', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    basePath?: string
    jdApiUrl?: string
    stagingDir?: string
    moviesDir?: string
    showsDir?: string
    otherDir?: string
    moverIntervalMs?: number
  } | null
  if (!body) return c.json({ error: 'invalid_body' }, 400)
  if (body.basePath !== undefined && basePathForcedByEnv()) {
    return c.json({ error: 'base_path_forced_by_env' }, 409)
  }
  try {
    const prev = getAppSettings()
    const settings = updateAppSettings(body)
    if (settings.moverIntervalMs !== prev.moverIntervalMs) restartMover()
    recordAudit('settings.update', JSON.stringify(body), c.get('username'))
    for (const dir of [
      settings.stagingDir,
      join(settings.stagingDir, 'movies'),
      join(settings.stagingDir, 'shows'),
      join(settings.stagingDir, 'downloads'),
      settings.moviesDir,
      settings.showsDir,
      settings.otherDir,
    ]) {
      await mkdir(dir, { recursive: true })
    }
    const restartRequired = body.basePath !== undefined && settings.basePath !== prev.basePath
    return c.json({ settings, restartRequired, basePathForcedByEnv: basePathForcedByEnv() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.get('/api/staging', requireAuth, async (c) => {
  const path = c.req.query('path') ?? ''
  try {
    return c.json({ path, entries: await listStaging(path) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'staging_list_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.delete('/api/staging', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as { path?: string } | null
  const path = body?.path?.trim() ?? ''
  if (!path) return c.json({ error: 'path_required' }, 400)
  try {
    await deleteStaging(path)
    recordAudit('staging.delete', path, c.get('username'))
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'staging_delete_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.get('/api/backup', requireAuth, async (c) => {
  try {
    const { path, filename } = await createBackupFile(join(tmpdir(), 'jdweb-backups'))
    const bytes = await readFileFs(path)
    void unlink(path).catch(() => undefined)
    recordAudit('backup.export', filename, c.get('username'))
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'backup_failed'
    return c.json({ error: message }, 500)
  }
})

app.post('/api/backup/restore', requireAuth, async (c) => {
  try {
    const form = await c.req.parseBody()
    const file = form.file
    if (!file || typeof file === 'string') return c.json({ error: 'file_required' }, 400)
    const buf = Buffer.from(await file.arrayBuffer())
    await restoreBackupBytes(buf)
    recordAudit('backup.restore', null, c.get('username'))
    return c.json({ ok: true, restartRequired: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'restore_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.get('/api/library/:root', requireAuth, async (c) => {
  const rootParam = c.req.param('root') ?? ''
  if (!isLibraryRoot(rootParam)) return c.json({ error: 'invalid_root' }, 400)
  const path = c.req.query('path') ?? ''
  try {
    return c.json({ folders: await listLibraryFolders(rootParam, path) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed'
    if (message === 'invalid_path') return c.json({ error: message }, 400)
    return c.json({ error: message }, 500)
  }
})

app.post('/api/destinations/resolve', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    kind?: DestinationKind
    title?: string
    season?: number
  } | null
  if (!body?.kind || !body.title?.trim()) {
    return c.json({ error: 'kind_and_title_required' }, 400)
  }
  const path = stagingPathFor({
    kind: body.kind,
    title: body.title,
    season: body.season,
  })
  return c.json({
    path,
    label: describeDestination(path),
  })
})

app.post('/api/mover/move', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    packageUuid?: number
    kind?: DestinationKind
    title?: string
    season?: number
  } | null
  if (body?.packageUuid == null || !body.kind || !body.title?.trim()) {
    return c.json({ error: 'invalid_body' }, 400)
  }
  const directory = stagingPathFor({
    kind: body.kind,
    title: body.title,
    season: body.season,
  })
  try {
    await movePackageNow(body.packageUuid, directory)
    return c.json({ ok: true, directory, label: describeDestination(directory) })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'move_failed' }, 500)
  }
})

app.post('/api/mover/run', requireAuth, async (c) => {
  try {
    const result = await runMoverNow()
    return c.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'mover_failed'
    const status = message === 'mover_busy' ? 409 : 500
    return c.json({ error: message }, status)
  }
})

app.get('/api/mover/history', requireAuth, (c) => {
  const raw = Number(c.req.query('limit') ?? 50)
  const limit = Number.isFinite(raw) ? raw : 50
  return c.json({ events: listMoveEvents(limit) })
})

app.get('/api/webhooks', requireAuth, (c) => c.json({ webhooks: listWebhooks() }))

app.post('/api/webhooks', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    url?: string
    events?: string[]
    enabled?: boolean
  } | null
  if (!body?.url?.trim()) return c.json({ error: 'url_required' }, 400)
  const events = (body.events ?? [...WEBHOOK_EVENTS]).filter((e): e is WebhookEvent =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e),
  )
  try {
    const webhook = createWebhook(body.url, events, body.enabled !== false)
    return c.json({ webhook }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed'
    return c.json({ error: message }, message === 'invalid_url' ? 400 : 500)
  }
})

app.patch('/api/webhooks/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid_id' }, 400)
  const body = (await c.req.json().catch(() => null)) as {
    url?: string
    events?: string[]
    enabled?: boolean
  } | null
  if (!body) return c.json({ error: 'invalid_body' }, 400)
  const events = body.events?.filter((e): e is WebhookEvent =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e),
  )
  try {
    const webhook = updateWebhook(id, {
      url: body.url,
      events,
      enabled: body.enabled,
    })
    if (!webhook) return c.json({ error: 'not_found' }, 404)
    return c.json({ webhook })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    return c.json({ error: message }, message === 'invalid_url' ? 400 : 500)
  }
})

app.delete('/api/webhooks/:id', requireAuth, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid_id' }, 400)
  if (!deleteWebhook(id)) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

app.get('/api/metrics', requireAuth, (c) => {
  const extra = {
    users: countUsers(),
    hosters: countHosters(),
    webhooks: countWebhooks(),
    webhook_failures: webhookFailureCount(),
  }
  const accept = c.req.header('accept') ?? ''
  if (accept.includes('text/plain')) {
    return c.text(metricsText(extra), 200, { 'content-type': 'text/plain; charset=utf-8' })
  }
  return c.json(snapshotMetrics(extra))
})

app.post('/api/webhooks/notify', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    event?: string
    package?: { uuid?: number; name?: string; saveTo?: string }
    error?: string
  } | null
  if (!body?.event || !(WEBHOOK_EVENTS as readonly string[]).includes(body.event)) {
    return c.json({ error: 'invalid_event' }, 400)
  }
  if (!body.package?.name?.trim()) return c.json({ error: 'package_required' }, 400)
  void dispatchWebhook({
    event: body.event as WebhookEvent,
    at: new Date().toISOString(),
    package: {
      uuid: body.package.uuid,
      name: body.package.name.trim(),
      saveTo: body.package.saveTo,
    },
    error: body.error,
  })
  return c.json({ ok: true })
})

app.all('/api/jd/*', requireAuth, async (c) => {
  const pathname = new URL(c.req.url).pathname
  const marker = '/api/jd'
  const at = pathname.indexOf(marker)
  let jdPath = at >= 0 ? pathname.slice(at + marker.length) : '/'
  if (!jdPath.startsWith('/')) jdPath = `/${jdPath}`
  const raw = await c.req.text()
  const upstream = await proxyJdRequest(jdPath, raw)
  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  return new Response(upstream.body, { status: upstream.status, headers })
})

async function ensureDirs(): Promise<void> {
  const s = getAppSettings()
  for (const dir of [
    s.stagingDir,
    join(s.stagingDir, 'movies'),
    join(s.stagingDir, 'shows'),
    join(s.stagingDir, 'downloads'),
    s.moviesDir,
    s.showsDir,
    s.otherDir,
  ]) {
    await mkdir(dir, { recursive: true })
  }
}

async function hasWebDist(): Promise<boolean> {
  try {
    await access(join(config.webDist, 'index.html'), constants.R_OK)
    return true
  } catch {
    return false
  }
}

const STATIC_ASSET_EXT =
  /\.(js|mjs|css|map|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|eot|webmanifest)$/i

/** True when the built index.html already embeds JDWEB_BASE_PATH in asset URLs. */
function htmlHasBasePath(html: string, basePath: string): boolean {
  return html.includes(`${basePath}/assets/`)
}

/**
 * Inject runtime base path (meta, CSP-safe) and rewrite root-absolute asset
 * URLs so a single root-built `web/dist` works behind any public prefix.
 */
function rewriteSpaHtml(html: string, basePath: string): string {
  const meta = `<meta name="jdweb-base-path" content="${basePath.replace(/"/g, '')}">`
  let out = /name=["']jdweb-base-path["']/.test(html)
    ? html.replace(
        /<meta\s+name=["']jdweb-base-path["']\s+content=["'][^"']*["']\s*\/?>/i,
        meta,
      )
    : html.replace(/<head([^>]*)>/i, `<head$1>${meta}`)
  if (basePath && !htmlHasBasePath(out, basePath)) {
    out = out.replaceAll('src="/', `src="${basePath}/`).replaceAll('href="/', `href="${basePath}/`)
  }
  return out
}

async function loadSpaHtml(basePath: string): Promise<string> {
  return rewriteSpaHtml(await readFile(join(config.webDist, 'index.html'), 'utf8'), basePath)
}

/** Resolve a file under web/dist (absolute root, cwd-independent). */
function resolveWebAsset(relPath: string): string | null {
  const root = resolve(config.webDist)
  const target = resolve(root, relPath)
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

async function main() {
  assertProductionSecrets()
  initDb()
  initAppSettings()
  await ensureDirs()
  const rotated = rotateHosterSecrets()
  if (rotated > 0) {
    log('info', 'rotated hoster secrets', { count: rotated })
  }
  await seedAdminFromEnv()
  const seededHooks = seedWebhooksFromEnv()
  if (seededHooks > 0) {
    log('info', 'seeded webhooks from env', { count: seededHooks })
  }
  startMover()

  const base = getBasePath()
  const staticRoot = config.webDist
  const uiBuilt = await hasWebDist()

  if (uiBuilt) {
    log('info', 'serving UI', {
      webDist: staticRoot,
      base: base || '/',
      basePathForcedByEnv: basePathForcedByEnv(),
    })

    const spaOrAsset = async (c: Context<{ Variables: Vars }>) => {
      const path = c.req.path
      const stripped = base && path.startsWith(base) ? path.slice(base.length) || '/' : path
      const rel = stripped.replace(/^\/+/, '')

      if (rel && rel !== 'index.html' && STATIC_ASSET_EXT.test(rel)) {
        const file = resolveWebAsset(rel)
        if (!file) {
          log('warn', 'asset path rejected', { rel })
          return c.text('Not Found', 404)
        }
        try {
          const body = await readFile(file)
          const mime = getMimeType(file) || 'application/octet-stream'
          return c.body(body, 200, {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
          })
        } catch {
          log('warn', 'asset missing', { rel, file, webDist: staticRoot })
          return c.text('Not Found', 404)
        }
      }

      return c.html(await loadSpaHtml(base))
    }

    app.get('/', (c) => spaOrAsset(c))
    app.get('/*', (c) => spaOrAsset(c))
  }

  const root = new Hono<{ Variables: Vars }>()
  if (base) {
    root.route(base, app)
  } else {
    root.route('/', app)
  }

  log('info', 'jdweb starting', {
    url: `http://${config.host}:${config.port}${base || '/'}`,
    webDist: staticRoot,
    uiBuilt,
    users: countUsers(),
  })
  if (countUsers() === 0) {
    log('info', 'no users yet; seed via JDWEB_USER/JDWEB_PASSWORD or POST /api/setup/admin from localhost')
  }
  if (!uiBuilt) {
    log('info', 'web dist missing; use Vite at http://127.0.0.1:5173 during development')
  }

  const server = serve({ fetch: root.fetch, hostname: config.host, port: config.port })
  server.on('error', (err: NodeJS.ErrnoException) => {
    log('error', 'listen failed', {
      error: err.message,
      code: err.code,
      host: config.host,
      port: config.port,
      hint: err.code === 'EADDRINUSE' ? `Stop the other process on port ${config.port}, then restart` : undefined,
    })
    process.exit(1)
  })
}

main().catch((err) => {
  log('error', 'fatal startup error', { error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
