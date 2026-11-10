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

    const badLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    })
    await expectStatus(badLogin, 401, 'bad login')

    const unauthMe = await fetch(`${base}/api/auth/me`)
    await expectStatus(unauthMe, 401, 'unauth me')

    const unauthEvents = await fetch(`${base}/api/events`)
    await expectStatus(unauthEvents, 401, 'unauth events')

    const unauthSettings = await fetch(`${base}/api/settings`)
    await expectStatus(unauthSettings, 401, 'unauth settings')

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    })
    if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`)
    const cookie = parseSetCookie(login)
    if (!cookie.includes('jdweb_session')) throw new Error('missing session cookie')

    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })
    if (!me.ok) throw new Error(`me failed: ${me.status}`)
    const meBody = await me.json()
    if (meBody.username !== 'admin') throw new Error(`unexpected me: ${JSON.stringify(meBody)}`)

    const events = await fetch(`${base}/api/events`, { headers: { Cookie: cookie } })
    if (!events.ok) throw new Error(`events failed: ${events.status}`)
    const reader = events.body?.getReader()
    if (reader) {
      const { value } = await reader.read()
      if (!value?.byteLength) throw new Error('empty sse stream')
      await reader.cancel()
    }

    const staging = await fetch(`${base}/api/staging`, { headers: { Cookie: cookie } })
    if (!staging.ok) throw new Error(`staging failed: ${staging.status}`)

    const settings = await fetch(`${base}/api/settings`, { headers: { Cookie: cookie } })
    await expectStatus(settings, 200, 'settings')
    const settingsBody = await settings.json()
    const jdUrl = settingsBody.jdApiUrl ?? settingsBody.settings?.jdApiUrl
    if (!String(jdUrl || '').includes(String(jdPort))) {
      throw new Error(`unexpected settings: ${JSON.stringify(settingsBody)}`)
    }

    const webhooks = await fetch(`${base}/api/webhooks`, { headers: { Cookie: cookie } })
    await expectStatus(webhooks, 200, 'webhooks')
    const webhooksBody = await webhooks.json()
    if (!Array.isArray(webhooksBody.webhooks)) throw new Error('webhooks list missing')

    const badWebhook = await fetch(`${base}/api/webhooks`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/hook', events: ['download.finished'] }),
    })
    if (badWebhook.status < 400) throw new Error(`private webhook should fail: ${badWebhook.status}`)

    const history = await fetch(`${base}/api/mover/history`, { headers: { Cookie: cookie } })
    await expectStatus(history, 200, 'mover history')

    const jdLinks = await fetch(`${base}/api/jd/downloadsV2/queryLinks`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
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

    const logout = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    await expectStatus(logout, 200, 'logout')
    const meAfter = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })
    await expectStatus(meAfter, 401, 'me after logout')

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
