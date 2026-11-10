#!/usr/bin/env node
/**
 * API/UI smoke without Playwright browsers: mock JD + built server + cookie login.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const jdPort = Number(process.env.MOCK_JD_PORT || 13128)
const port = Number(process.env.JDWEB_PORT || 8787)
const base = `http://127.0.0.1:${port}`
const dbPath = resolve(root, 'data/e2e.sqlite')

function run(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  child.stdout.on('data', (d) => process.stdout.write(`[${args[0] || cmd}] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[${args[0] || cmd}] ${d}`))
  child.unref()
  return child
}

async function waitHttp(url, { method = 'GET', body, tries = 60 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      if (res.status > 0) return res
    } catch {
      /* retry */
    }
    await sleep(500)
  }
  throw new Error(`timeout waiting for ${url}`)
}

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  if (raw.length) return raw.map((c) => c.split(';')[0]).join('; ')
  const single = res.headers.get('set-cookie')
  return single ? single.split(';')[0] : ''
}

async function expectStatus(res, status, label) {
  if (res.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${res.status} ${await res.text()}`)
  }
}

async function authed(path, cookie, init = {}) {
  const headers = { ...(init.headers || {}), Cookie: cookie }
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  return fetch(`${base}${path}`, { ...init, headers })
}

async function main() {
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-wal`, { force: true })
  rmSync(`${dbPath}-shm`, { force: true })

  const mock = run('node', ['e2e/mock-jd.mjs'], { MOCK_JD_PORT: String(jdPort) })
  await waitHttp(`http://127.0.0.1:${jdPort}/jd/version`, {
    method: 'POST',
    body: '{"params":[]}',
  })

  const server = run('node', ['server/dist/index.js'], {
    JDWEB_HOST: '127.0.0.1',
    JDWEB_PORT: String(port),
    JD_API_URL: `http://127.0.0.1:${jdPort}`,
    JDWEB_DB_PATH: dbPath,
    JDWEB_USER: 'admin',
    JDWEB_PASSWORD: 'password123',
    JDWEB_SESSION_SECRET: 'e2e-session-secret-not-for-prod',
    JDWEB_DATA_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  })

  try {
    const health = await waitHttp(`${base}/api/health`)
    await expectStatus(health, 200, 'health')
    const healthBody = await health.json()
    if (!healthBody.ok) throw new Error(`health not ok: ${JSON.stringify(healthBody)}`)
    if ('jdApiUrl' in healthBody) throw new Error('health must not expose jdApiUrl')
    if (healthBody.jdReachable !== true) throw new Error(`jd not reachable: ${JSON.stringify(healthBody)}`)

    const setupStatus = await fetch(`${base}/api/setup/status`)
    await expectStatus(setupStatus, 200, 'setup status')
    const setupBody = await setupStatus.json()
    if (setupBody.needsSetup !== false) throw new Error(`expected setup done: ${JSON.stringify(setupBody)}`)

    const badLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    })
    await expectStatus(badLogin, 401, 'bad login')

    await expectStatus(await fetch(`${base}/api/auth/me`), 401, 'unauth me')
    await expectStatus(await fetch(`${base}/api/events`), 401, 'unauth events')
    await expectStatus(await fetch(`${base}/api/settings`), 401, 'unauth settings')
    await expectStatus(await fetch(`${base}/api/hosters`), 401, 'unauth hosters')
    await expectStatus(await fetch(`${base}/api/users`), 401, 'unauth users')
    await expectStatus(await fetch(`${base}/api/backup`), 401, 'unauth backup')

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    })
    if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`)
    const cookie = parseSetCookie(login)
    if (!cookie.includes('jdweb_session')) throw new Error('missing session cookie')

    const me = await authed('/api/auth/me', cookie)
    await expectStatus(me, 200, 'me')
    const meBody = await me.json()
    if (meBody.username !== 'admin') throw new Error(`unexpected me: ${JSON.stringify(meBody)}`)

    const events = await authed('/api/events', cookie)
    await expectStatus(events, 200, 'events')
    const reader = events.body?.getReader()
    if (reader) {
      const { value } = await reader.read()
      if (!value?.byteLength) throw new Error('empty sse stream')
      await reader.cancel()
    }

    const staging = await authed('/api/staging', cookie)
    await expectStatus(staging, 200, 'staging')

    const settings = await authed('/api/settings', cookie)
    await expectStatus(settings, 200, 'settings')
    const settingsBody = await settings.json()
    const jdUrl = settingsBody.settings?.jdApiUrl
    if (!String(jdUrl || '').includes(String(jdPort))) {
      throw new Error(`unexpected settings: ${JSON.stringify(settingsBody)}`)
    }

    const publicConfig = await authed('/api/config/public', cookie)
    await expectStatus(publicConfig, 200, 'public config')
    const publicBody = await publicConfig.json()
    if (!publicBody.version || !String(publicBody.jdApiUrl || '').includes(String(jdPort))) {
      throw new Error(`unexpected public config: ${JSON.stringify(publicBody)}`)
    }

    const webhooks = await authed('/api/webhooks', cookie)
    await expectStatus(webhooks, 200, 'webhooks')
    if (!Array.isArray((await webhooks.json()).webhooks)) throw new Error('webhooks list missing')

    const badWebhook = await authed('/api/webhooks', cookie, {
      method: 'POST',
      body: JSON.stringify({ url: 'http://127.0.0.1/hook', events: ['download.finished'] }),
    })
    if (badWebhook.status < 400) throw new Error(`private webhook should fail: ${badWebhook.status}`)

    const goodWebhook = await authed('/api/webhooks', cookie, {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://hooks.example.com/jdweb-e2e',
        events: ['download.finished', 'mover.succeeded'],
      }),
    })
    await expectStatus(goodWebhook, 201, 'create webhook')
    const createdHook = (await goodWebhook.json()).webhook
    const patchHook = await authed(`/api/webhooks/${createdHook.id}`, cookie, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    })
    await expectStatus(patchHook, 200, 'patch webhook')
    const delHook = await authed(`/api/webhooks/${createdHook.id}`, cookie, { method: 'DELETE' })
    await expectStatus(delHook, 200, 'delete webhook')

    const history = await authed('/api/mover/history', cookie)
    await expectStatus(history, 200, 'mover history')
    const runMover = await authed('/api/mover/run', cookie, { method: 'POST', body: '{}' })
    await expectStatus(runMover, 200, 'mover run')

    const dest = await authed('/api/destinations/resolve', cookie, {
      method: 'POST',
      body: JSON.stringify({ kind: 'movies', title: 'E2E Movie' }),
    })
    await expectStatus(dest, 200, 'destinations resolve')
    const destBody = await dest.json()
    if (!destBody.path || !String(destBody.path).includes('movies')) {
      throw new Error(`unexpected destination: ${JSON.stringify(destBody)}`)
    }

    for (const lib of ['movies', 'shows', 'other']) {
      const libRes = await authed(`/api/library/${lib}`, cookie)
      await expectStatus(libRes, 200, `library ${lib}`)
    }
    await expectStatus(await authed('/api/library/nope', cookie), 400, 'library invalid')

    const users = await authed('/api/users', cookie)
    await expectStatus(users, 200, 'users')
    if (!(await users.json()).users?.some((u) => u.username === 'admin')) {
      throw new Error('admin missing from users list')
    }

    const sessions = await authed('/api/sessions', cookie)
    await expectStatus(sessions, 200, 'sessions')
    if (!Array.isArray((await sessions.json()).sessions)) throw new Error('sessions list missing')

    const hostersEmpty = await authed('/api/hosters', cookie)
    await expectStatus(hostersEmpty, 200, 'hosters list')
    const createdHoster = await authed('/api/hosters', cookie, {
      method: 'POST',
      body: JSON.stringify({
        hoster: 'rapidgator.net',
        username: 'e2e@example.com',
        password: 'e2e-secret',
      }),
    })
    await expectStatus(createdHoster, 201, 'create hoster')
    const hoster = await createdHoster.json()
    const hosterId = hoster.id
    if (hosterId == null) throw new Error(`unexpected hoster create: ${JSON.stringify(hoster)}`)
    const disableHoster = await authed(`/api/hosters/${hosterId}`, cookie, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    })
    await expectStatus(disableHoster, 200, 'disable hoster')
    const deleteHoster = await authed(`/api/hosters/${hosterId}`, cookie, { method: 'DELETE' })
    await expectStatus(deleteHoster, 200, 'delete hoster')

    const metrics = await authed('/api/metrics', cookie)
    await expectStatus(metrics, 200, 'metrics')

    const backup = await authed('/api/backup', cookie)
    await expectStatus(backup, 200, 'backup')
    const backupBytes = Buffer.from(await backup.arrayBuffer())
    if (backupBytes.subarray(0, 15).toString() !== 'SQLite format 3') {
      throw new Error('backup is not a sqlite file')
    }

    const jdLinks = await authed('/api/jd/downloadsV2/queryLinks', cookie, {
      method: 'POST',
      body: JSON.stringify({ params: [{}] }),
    })
    await expectStatus(jdLinks, 200, 'jd queryLinks')
    const jdBody = await jdLinks.json()
    if (!Array.isArray(jdBody.data)) throw new Error(`jd proxy unexpected: ${JSON.stringify(jdBody)}`)

    const spa = await fetch(`${base}/`)
    if (!spa.ok) throw new Error(`spa failed: ${spa.status}`)
    const html = await spa.text()
    if (!html.includes('jdweb') && !html.includes('app')) throw new Error('spa html unexpected')
    if (!html.includes('jdweb-base-path')) throw new Error('spa missing base-path meta')

    const logout = await authed('/api/auth/logout', cookie, { method: 'POST' })
    await expectStatus(logout, 200, 'logout')
    await expectStatus(await authed('/api/auth/me', cookie), 401, 'me after logout')

    console.log('e2e api-smoke OK')
  } finally {
    for (const child of [server, mock]) {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM')
      } catch {
        try {
          child.kill('SIGTERM')
        } catch {
          /* sandbox may deny kill */
        }
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
