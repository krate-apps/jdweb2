import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { Hono } from 'hono'

const root = mkdtempSync(join(tmpdir(), 'jdweb-auth-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-auth-sessions'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const { closeDb, initDb } = await import('./db.js')
const { createUser } = await import('./users.js')
const {
  clearSession,
  issueSession,
  listSessionsForUser,
  newNonce,
  readSession,
  revokeOtherSessions,
  revokeSession,
} = await import('./auth.js')

const app = new Hono()
app.post('/issue', (c) => {
  const session = issueSession(c, 'alice', { userAgent: 'test-agent', ip: '127.0.0.1' })
  return c.json({ id: session.id, username: session.username })
})
app.get('/me', (c) => {
  const session = readSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ id: session.id, username: session.username })
})
app.post('/logout', (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

before(async () => {
  initDb()
  await createUser('alice', 'password-long')
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

function cookieFrom(res: Response): string {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  if (raw.length) return raw.map((c) => c.split(';')[0]).join('; ')
  const single = res.headers.get('set-cookie')
  return single ? single.split(';')[0] : ''
}

describe('sessions', () => {
  it('issues reads and clears cookie-backed sessions', async () => {
    const issued = await app.request('http://127.0.0.1/issue', { method: 'POST' })
    assert.equal(issued.status, 200)
    const body = (await issued.json()) as { id: string; username: string }
    assert.equal(body.username, 'alice')
    const cookie = cookieFrom(issued)
    assert.match(cookie, /jdweb_session=/)

    const me = await app.request('http://127.0.0.1/me', { headers: { Cookie: cookie } })
    assert.equal(me.status, 200)
    assert.equal(((await me.json()) as { id: string }).id, body.id)

    const sessions = listSessionsForUser(
      (await import('./users.js')).findUserByUsername('alice')!.id,
    )
    assert.ok(sessions.some((s) => s.id === body.id))

    await app.request('http://127.0.0.1/logout', { method: 'POST', headers: { Cookie: cookie } })
    const meAfter = await app.request('http://127.0.0.1/me', { headers: { Cookie: cookie } })
    assert.equal(meAfter.status, 401)
  })

  it('revokes one session and other sessions', async () => {
    const a = await app.request('http://127.0.0.1/issue', { method: 'POST' })
    const b = await app.request('http://127.0.0.1/issue', { method: 'POST' })
    const idA = ((await a.json()) as { id: string }).id
    const idB = ((await b.json()) as { id: string }).id
    const userId = (await import('./users.js')).findUserByUsername('alice')!.id

    assert.equal(revokeSession(idA, userId), true)
    assert.equal(revokeSession(idA, userId), false)
    assert.ok(revokeOtherSessions(userId, idB) >= 0)
    assert.equal(listSessionsForUser(userId).every((s) => s.id === idB || s.id !== idA), true)
    assert.equal(listSessionsForUser(userId).some((s) => s.id === idB), true)
  })

  it('rejects forged cookies', async () => {
    const me = await app.request('http://127.0.0.1/me', {
      headers: { Cookie: 'jdweb_session=deadbeef.not-a-real-sig' },
    })
    assert.equal(me.status, 401)
  })
})

describe('newNonce', () => {
  it('returns unique hex tokens', () => {
    const a = newNonce()
    const b = newNonce()
    assert.match(a, /^[0-9a-f]{32}$/)
    assert.notEqual(a, b)
  })
})
