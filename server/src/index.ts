import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.js'
import {
  clearSession,
  issueSession,
  readSession,
  requireAuth,
  safeEqual,
} from './auth.js'
import { proxyJdRequest } from './jd.js'
import { describeDestination, stagingPathFor, type DestinationKind } from './destinations.js'
import { movePackageNow, startMover } from './mover.js'

type Vars = { username: string }

const app = new Hono<{ Variables: Vars }>()
const base = config.basePath

function mount(path: string): string {
  if (!base) return path
  return path === '/' ? base : `${base}${path}`
}

app.get(mount('/api/health'), (c) =>
  c.json({
    ok: true,
    basePath: base || '/',
    mover: config.moverIntervalMs > 0,
  }),
)

app.post(mount('/api/auth/login'), async (c) => {
  const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
  const username = body?.username ?? ''
  const password = body?.password ?? ''
  if (!safeEqual(username, config.user) || !safeEqual(password, config.password)) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  issueSession(c, username)
  return c.json({ username })
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

app.get(mount('/api/config/public'), requireAuth, (c) =>
  c.json({
    stagingDir: config.stagingDir,
    moviesDir: config.moviesDir,
    showsDir: config.showsDir,
    otherDir: config.otherDir,
    moverEnabled: config.moverIntervalMs > 0,
  }),
)

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

async function main() {
  await ensureDirs()
  startMover()

  const staticRoot = config.webDist
  // serveStatic resolves paths from process.cwd(); prefer repo-root relative path.
  const staticRootRel = 'web/dist'
  app.use(
    `${base || ''}/*`,
    serveStatic({
      root: staticRootRel,
      rewriteRequestPath: (path) => {
        const stripped = base && path.startsWith(base) ? path.slice(base.length) || '/' : path
        return stripped.replace(/^\/+/, '') || 'index.html'
      },
    }),
  )

  app.get(mount('/'), async (c) => {
    try {
      const { readFile } = await import('node:fs/promises')
      let html = await readFile(join(staticRoot, 'index.html'), 'utf8')
      if (base) {
        html = html.replaceAll('="/', `("${base}/`).replaceAll("('/", `('${base}/`)
      }
      return c.html(html)
    } catch {
      return c.text(
        'jdweb UI is not built yet. Run `pnpm --filter ./web build` or `pnpm dev:web` during development.',
        503,
      )
    }
  })

  // SPA fallback for client routes
  app.get(`${base || ''}/*`, async (c) => {
    try {
      const { readFile } = await import('node:fs/promises')
      return c.html(await readFile(join(staticRoot, 'index.html'), 'utf8'))
    } catch {
      return c.text('Not found', 404)
    }
  })

  console.log(`jdweb listening on http://${config.host}:${config.port}${base || '/'}`)
  serve({ fetch: app.fetch, hostname: config.host, port: config.port })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
