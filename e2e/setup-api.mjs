#!/usr/bin/env node
/**
 * First-run setup API smoke: empty DB (no JDWEB2_USER seed), localhost admin bootstrap.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dirname, '..')
const jdPort = Number(process.env.SETUP_MOCK_JD_PORT || 13129)
const port = Number(process.env.SETUP_JDWEB2_PORT || 8788)
const base = `http://127.0.0.1:${port}`
const dataDir = join(tmpdir(), `jdweb-setup-api-${process.pid}`)
const dbPath = join(dataDir, 'setup.sqlite')
const stagingDir = join(dataDir, 'staging')
const moviesDir = join(dataDir, 'movies')
const showsDir = join(dataDir, 'shows')
const otherDir = join(dataDir, 'other')

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
  rmSync(dataDir, { recursive: true, force: true })
  mkdirSync(dataDir, { recursive: true })

  const mock = run('node', ['e2e/mock-jd.mjs'], { MOCK_JD_PORT: String(jdPort) })
  await waitHttp(`http://127.0.0.1:${jdPort}/jd/version`, {
    method: 'POST',
    body: '{"params":[]}',
  })

  // Clear inherited seed creds so needsSetup stays true (dotenv won't override set keys).
  const server = run('node', ['server/dist/index.js'], {
    JDWEB2_HOST: '127.0.0.1',
    JDWEB2_PORT: String(port),
    JD_API_URL: `http://127.0.0.1:${jdPort}`,
    JDWEB2_DB_PATH: dbPath,
    JDWEB2_STAGING_DIR: stagingDir,
    JDWEB2_MOVIES_DIR: moviesDir,
    JDWEB2_SHOWS_DIR: showsDir,
    JDWEB2_OTHER_DIR: otherDir,
    JDWEB2_SESSION_SECRET: 'e2e-setup-session-secret-not-for-prod',
    JDWEB2_DATA_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    JDWEB2_USER: '',
    JDWEB2_PASSWORD: '',
  })

  try {
    const health = await waitHttp(`${base}/api/health`)
    await expectStatus(health, 200, 'health')
    const healthBody = await health.json()
    if (healthBody.needsSetup !== true) {
      throw new Error(`expected needsSetup: ${JSON.stringify(healthBody)}`)
    }

    const status = await fetch(`${base}/api/setup/status`)
    await expectStatus(status, 200, 'setup status')
    if ((await status.json()).needsSetup !== true) throw new Error('setup status should be true')

    const loginBlocked = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    })
    await expectStatus(loginBlocked, 503, 'login before setup')
    if ((await loginBlocked.json()).error !== 'needs_setup') {
      throw new Error('login should report needs_setup')
    }

    const shortPw = await fetch(`${base}/api/setup/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'short' }),
    })
    await expectStatus(shortPw, 400, 'short password')

    // X-Forwarded-For must not block localhost TCP peers.
    const create = await fetch(`${base}/api/setup/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '8.8.8.8',
      },
      body: JSON.stringify({ username: 'setupadmin', password: 'password123' }),
    })
    await expectStatus(create, 200, 'create admin')
    const created = await create.json()
    if (created.username !== 'setupadmin') throw new Error(`unexpected create: ${JSON.stringify(created)}`)
    const cookie = parseSetCookie(create)
    if (!cookie.includes('jdweb_session')) throw new Error('missing session after setup')

    const again = await fetch(`${base}/api/setup/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'other', password: 'password123' }),
    })
    await expectStatus(again, 403, 'setup already done')
    if ((await again.json()).error !== 'setup_already_done') {
      throw new Error('expected setup_already_done')
    }

    const statusDone = await fetch(`${base}/api/setup/status`)
    if ((await statusDone.json()).needsSetup !== false) throw new Error('setup should be done')

    const probeBad = await fetch(`${base}/api/setup/probe-jd`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://example.com:3128' }),
    })
    if (probeBad.status < 400) throw new Error('public JD probe URL should fail')

    const probeOk = await fetch(`${base}/api/setup/probe-jd`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `http://127.0.0.1:${jdPort}` }),
    })
    await expectStatus(probeOk, 200, 'probe jd')
    const probed = await probeOk.json()
    if (probed.ok !== true) throw new Error(`probe failed: ${JSON.stringify(probed)}`)

    const patchJd = await fetch(`${base}/api/settings`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jdApiUrl: `http://127.0.0.1:${jdPort}` }),
    })
    await expectStatus(patchJd, 200, 'patch jd url')

    const patchPaths = await fetch(`${base}/api/settings`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stagingDir,
        moviesDir,
        showsDir,
        otherDir,
      }),
    })
    await expectStatus(patchPaths, 200, 'patch paths')
    const settings = (await patchPaths.json()).settings
    if (settings.stagingDir !== stagingDir) {
      throw new Error(`staging not saved: ${JSON.stringify(settings)}`)
    }

    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })
    await expectStatus(me, 200, 'me after setup')
    if ((await me.json()).username !== 'setupadmin') throw new Error('session username mismatch')

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'setupadmin', password: 'password123' }),
    })
    await expectStatus(login, 200, 'login after setup')

    console.log('e2e setup-api OK')
  } finally {
    for (const child of [server, mock]) {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM')
      } catch {
        try {
          child.kill('SIGTERM')
        } catch {
          /* ignore */
        }
      }
    }
    rmSync(dataDir, { recursive: true, force: true })
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
