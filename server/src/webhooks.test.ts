import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'jdweb-hooks-'))
process.env.JDWEB2_DB_PATH = join(root, 'test.sqlite')
process.env.JDWEB2_SESSION_SECRET = 'test-secret-for-jdweb-hooks'
process.env.JDWEB2_DATA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const { closeDb, initDb } = await import('./db.js')
const {
  countWebhooks,
  createWebhook,
  deleteWebhook,
  dispatchWebhook,
  listWebhooks,
  updateWebhook,
  webhookFailureCount,
} = await import('./webhooks.js')

before(() => {
  initDb()
})

after(() => {
  closeDb()
  rmSync(root, { recursive: true, force: true })
})

describe('webhooks CRUD', () => {
  it('creates lists updates and deletes public hooks', () => {
    assert.equal(countWebhooks(), 0)
    const created = createWebhook('https://hooks.example.com/a', ['download.finished'])
    assert.equal(created.url, 'https://hooks.example.com/a')
    assert.deepEqual(created.events, ['download.finished'])
    assert.equal(created.enabled, true)
    assert.equal(listWebhooks().length, 1)

    const updated = updateWebhook(created.id, {
      events: ['mover.succeeded', 'mover.failed'],
      enabled: false,
    })
    assert.ok(updated)
    assert.equal(updated.enabled, false)
    assert.deepEqual(updated.events, ['mover.succeeded', 'mover.failed'])

    assert.equal(deleteWebhook(created.id), true)
    assert.equal(countWebhooks(), 0)
    assert.equal(deleteWebhook(created.id), false)
  })

  it('rejects private webhook URLs on create and update', () => {
    assert.throws(() => createWebhook('http://127.0.0.1/hook', ['download.finished']), /webhook_url_not_public/)
    const ok = createWebhook('https://hooks.example.com/safe', ['download.finished'])
    assert.throws(
      () => updateWebhook(ok.id, { url: 'http://10.0.0.1/hook' }),
      /webhook_url_not_public/,
    )
    deleteWebhook(ok.id)
  })
})

describe('dispatchWebhook', () => {
  it('posts matching enabled events and counts failures', async () => {
    const beforeFailures = webhookFailureCount()
    const received: unknown[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        received.push(JSON.parse(body))
        res.writeHead(200)
        res.end('ok')
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as { port: number }
    // Localhost is private — assertSafeWebhookUrl blocks it. Seed via SQL for delivery tests.
    const { getDb } = await import('./db.js')
    const now = Date.now()
    getDb()
      .prepare(
        `INSERT INTO webhooks (url, events, enabled, created_at, updated_at) VALUES (?, ?, 1, ?, ?)`,
      )
      .run(
        `http://127.0.0.1:${port}/hook`,
        JSON.stringify(['download.finished']),
        now,
        now,
      )

    await dispatchWebhook({
      event: 'download.finished',
      at: new Date().toISOString(),
      package: { name: 'pack', uuid: 1 },
    })
    await dispatchWebhook({
      event: 'mover.failed',
      at: new Date().toISOString(),
      package: { name: 'other' },
      error: 'nope',
    })

    assert.equal(received.length, 1)
    assert.equal((received[0] as { package: { name: string } }).package.name, 'pack')
    assert.equal(webhookFailureCount(), beforeFailures)

    // Force a failure with a dead target still in DB for an enabled matching event.
    getDb()
      .prepare(`UPDATE webhooks SET url = ?, events = ?, enabled = 1`)
      .run('http://127.0.0.1:1/dead', JSON.stringify(['mover.failed']))
    await dispatchWebhook({
      event: 'mover.failed',
      at: new Date().toISOString(),
      package: { name: 'dead' },
      error: 'x',
    })
    assert.ok(webhookFailureCount() > beforeFailures)

    server.close()
    getDb().prepare('DELETE FROM webhooks').run()
  })
})
