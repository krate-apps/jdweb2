#!/usr/bin/env node
import { createServer } from 'node:http'

const port = Number(process.env.MOCK_JD_PORT || 13128)

const accounts = []
let nextUuid = 1

function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ data }))
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  const body = await readBody(req)
  const params = Array.isArray(body.params) ? body.params : []

  if (url.pathname === '/jd/version') return json(res, 1)
  if (url.pathname === '/downloadsV2/queryLinks') return json(res, [])
  if (url.pathname === '/downloadsV2/queryPackages') return json(res, [])
  if (url.pathname === '/downloadcontroller/getCurrentState') return json(res, 'IDLE')
  if (url.pathname === '/linkgrabberv2/queryLinks') return json(res, [])
  if (url.pathname === '/dialogs/list') return json(res, [])
  if (url.pathname === '/extraction/getArchiveInfo') return json(res, [])
  if (url.pathname.startsWith('/config/')) return json(res, 0)

  if (url.pathname === '/accountsV2/listAccounts') return json(res, accounts)
  if (url.pathname === '/accountsV2/addAccount') {
    const [hostname, username] = params
    if (!accounts.some((a) => a.hostname === hostname && a.username === username)) {
      accounts.push({
        uuid: nextUuid++,
        hostname,
        username,
        enabled: true,
        valid: true,
        status: 'VALID',
        trafficLeft: 1024,
        trafficMax: 2048,
      })
    }
    return json(res, null)
  }
  if (url.pathname === '/accountsV2/removeAccounts') {
    const ids = new Set(params[0] || [])
    for (let i = accounts.length - 1; i >= 0; i--) {
      if (ids.has(accounts[i].uuid)) accounts.splice(i, 1)
    }
    return json(res, null)
  }
  if (url.pathname === '/accountsV2/enableAccounts' || url.pathname === '/accountsV2/disableAccounts') {
    const ids = new Set(params[0] || [])
    const enabled = url.pathname.includes('enable')
    for (const acc of accounts) {
      if (ids.has(acc.uuid)) acc.enabled = enabled
    }
    return json(res, null)
  }
  if (url.pathname === '/accountsV2/refreshAccounts') return json(res, null)

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found', path: url.pathname, body }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`mock JD on http://127.0.0.1:${port}`)
})
