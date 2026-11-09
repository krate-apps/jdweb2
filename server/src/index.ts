import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { access, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.js'
import {
  clearSession,
  issueSession,
  listSessionsForUser,
  readSession,
  requireAuth,
  revokeOtherSessions,
  revokeSession,
} from './auth.js'
import { proxyJdRequest } from './jd.js'
import { describeDestination, stagingPathFor, type DestinationKind } from './destinations.js'
import { movePackageNow, runMoverNow, startMover } from './mover.js'
import { listMoveEvents } from './move-history.js'
import { initDb } from './db.js'
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

type Vars = { username: string; sessionId: string; userId: number }

const app = new Hono<{ Variables: Vars }>()
const base = config.basePath

function mount(path: string): string {
  if (!base) return path
  return path === '/' ? base : `${base}${path}`
}

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
      return 400
    case 'setup_localhost_only':
      return 403
    default:
      return 500
  }
}

app.get(mount('/api/health'), (c) =>
  c.json({
    ok: true,
    basePath: base || '/',
    mover: config.moverIntervalMs > 0,
    needsSetup: countUsers() === 0,
  }),
)

app.get(mount('/api/setup/status'), (c) => c.json({ needsSetup: countUsers() === 0 }))

app.post(mount('/api/setup/admin'), async (c) => {
  if (countUsers() > 0) return c.json({ error: 'setup_already_done' }, 403)
  if (!isLoopback(c)) return c.json({ error: 'setup_localhost_only' }, 403)
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  try {
    const user = await createUser(body?.username ?? '', body?.password ?? '')
    issueSession(c, user.username, sessionMeta(c))
    return c.json({ username: user.username })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'setup_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.post(mount('/api/auth/login'), async (c) => {
  if (countUsers() === 0) return c.json({ error: 'needs_setup' }, 503)
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  const user = await verifyLogin(body?.username ?? '', body?.password ?? '')
  if (!user) {
    noteAuthLogin(false)
    log('warn', 'auth login failed', { username: body?.username?.trim() || null })
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  noteAuthLogin(true)
  log('info', 'auth login ok', { username: user.username })
  issueSession(c, user.username, sessionMeta(c))
  return c.json({ username: user.username })
})

app.post(mount('/api/auth/logout'), (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

app.get(mount('/api/auth/me'), (c) => {
  const session = readSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ username: session.username })
})

app.get(mount('/api/sessions'), requireAuth, (c) => {
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

app.delete(mount('/api/sessions/:id'), requireAuth, (c) => {
  const id = c.req.param('id') ?? ''
  if (!id || !revokeSession(id, c.get('userId'))) return c.json({ error: 'session_not_found' }, 404)
  if (id === c.get('sessionId')) clearSession(c)
  return c.json({ ok: true })
})

app.delete(mount('/api/sessions'), requireAuth, (c) => {
  const removed = revokeOtherSessions(c.get('userId'), c.get('sessionId'))
  return c.json({ ok: true, removed })
})

app.get(mount('/api/users'), requireAuth, (c) => c.json({ users: listUsers() }))

app.post(mount('/api/users/me/password'), requireAuth, async (c) => {
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

app.post(mount('/api/users'), requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  try {
    const user = await createUser(body?.username ?? '', body?.password ?? '')
    return c.json(user, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.patch(mount('/api/users/:id'), requireAuth, async (c) => {
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

app.delete(mount('/api/users/:id'), requireAuth, (c) => {
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

app.get(mount('/api/hosters'), requireAuth, async (c) => {
  try {
    return c.json({ hosters: await listHosters() })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'list_failed' }, 500)
  }
})

app.post(mount('/api/hosters'), requireAuth, async (c) => {
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

app.patch(mount('/api/hosters/:id'), requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  const body = (await c.req.json().catch(() => null)) as {
    enabled?: boolean
    password?: string
  } | null
  try {
    if (typeof body?.password === 'string' && body.password.length > 0) {
      return c.json(await updateHosterPassword(id, body.password))
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

app.delete(mount('/api/hosters/:id'), requireAuth, async (c) => {
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

app.post(mount('/api/hosters/refresh'), requireAuth, async (c) => {
  try {
    return c.json({ hosters: await refreshHosters() })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'refresh_failed' }, 500)
  }
})

app.post(mount('/api/hosters/import'), requireAuth, async (c) => {
  try {
    return c.json(await importHostersFromJd())
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'import_failed' }, 500)
  }
})

app.post(mount('/api/hosters/:id/resync'), requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_body' }, 400)
  try {
    return c.json(await resyncHoster(id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'resync_failed'
    return c.json({ error: message }, errorStatus(message))
  }
})

app.get(mount('/api/config/public'), requireAuth, (c) =>
  c.json({
    stagingDir: config.stagingDir,
    moviesDir: config.moviesDir,
    showsDir: config.showsDir,
    otherDir: config.otherDir,
    moverEnabled: config.moverIntervalMs > 0,
  }),
)

app.get(mount('/api/library/:root'), requireAuth, async (c) => {
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

app.post(mount('/api/destinations/resolve'), requireAuth, async (c) => {
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

app.post(mount('/api/mover/move'), requireAuth, async (c) => {
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

app.post(mount('/api/mover/run'), requireAuth, async (c) => {
  try {
    const result = await runMoverNow()
    return c.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'mover_failed'
    const status = message === 'mover_busy' ? 409 : 500
    return c.json({ error: message }, status)
  }
})

app.get(mount('/api/mover/history'), requireAuth, (c) => {
  const raw = Number(c.req.query('limit') ?? 50)
  const limit = Number.isFinite(raw) ? raw : 50
  return c.json({ events: listMoveEvents(limit) })
})

app.get(mount('/api/webhooks'), requireAuth, (c) => c.json({ webhooks: listWebhooks() }))

app.post(mount('/api/webhooks'), requireAuth, async (c) => {
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

app.patch(mount('/api/webhooks/:id'), requireAuth, async (c) => {
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

app.delete(mount('/api/webhooks/:id'), requireAuth, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid_id' }, 400)
  if (!deleteWebhook(id)) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

app.get(mount('/api/metrics'), requireAuth, (c) => {
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

app.post(mount('/api/webhooks/notify'), requireAuth, async (c) => {
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

app.all(mount('/api/jd/*'), requireAuth, async (c) => {
  const prefix = mount('/api/jd')
  const url = new URL(c.req.url)
  let jdPath = url.pathname.slice(prefix.length)
  if (!jdPath.startsWith('/')) jdPath = `/${jdPath}`
  const raw = await c.req.text()
  const upstream = await proxyJdRequest(jdPath, raw)
  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  return new Response(upstream.body, { status: upstream.status, headers })
})

async function ensureDirs(): Promise<void> {
  for (const dir of [
    config.stagingDir,
    join(config.stagingDir, 'movies'),
    join(config.stagingDir, 'shows'),
    join(config.stagingDir, 'downloads'),
    config.moviesDir,
    config.showsDir,
    config.otherDir,
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

async function main() {
  await ensureDirs()
  initDb()
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

  const staticRoot = config.webDist
  const uiBuilt = await hasWebDist()

  if (uiBuilt) {
    // Absolute root: pnpm --filter runs with cwd=server/, so "web/dist" would miss.
    app.use(
      `${base || ''}/*`,
      serveStatic({
        root: staticRoot,
        rewriteRequestPath: (path) => {
          const stripped = base && path.startsWith(base) ? path.slice(base.length) || '/' : path
          return stripped.replace(/^\/+/, '') || 'index.html'
        },
      }),
    )

    app.get(mount('/'), async (c) => {
      const { readFile } = await import('node:fs/promises')
      let html = await readFile(join(staticRoot, 'index.html'), 'utf8')
      if (base) {
        html = html.replaceAll('("/', `("${base}/`).replaceAll("('/", `('${base}/`)
      }
      return c.html(html)
    })

    app.get(`${base || ''}/*`, async (c) => {
      const { readFile } = await import('node:fs/promises')
      return c.html(await readFile(join(staticRoot, 'index.html'), 'utf8'))
    })
  }

  log('info', 'jdweb listening', {
    url: `http://${config.host}:${config.port}${base || '/'}`,
    users: countUsers(),
    uiBuilt,
  })
  if (countUsers() === 0) {
    log('info', 'no users yet; seed via JDWEB_USER/JDWEB_PASSWORD or POST /api/setup/admin from localhost')
  }
  if (!uiBuilt) {
    log('info', 'web dist missing; use Vite at http://127.0.0.1:5173 during development')
  }
  serve({ fetch: app.fetch, hostname: config.host, port: config.port })
}

main().catch((err) => {
  log('error', 'fatal startup error', { error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
