#!/usr/bin/env node
import { createServer } from 'node:http'

const port = Number(process.env.MOCK_JD_PORT || 13128)

function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ data }))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  let body = ''
  for await (const chunk of req) body += chunk

  if (url.pathname === '/jd/version') return json(res, 1)
  if (url.pathname === '/downloadsV2/queryLinks') return json(res, [])
  if (url.pathname === '/downloadsV2/queryPackages') return json(res, [])
  if (url.pathname === '/downloadcontroller/getCurrentState') return json(res, 'IDLE')
  if (url.pathname === '/linkgrabberv2/queryLinks') return json(res, [])
  if (url.pathname === '/dialogs/list') return json(res, [])
  if (url.pathname.startsWith('/config/')) return json(res, 0)
  if (url.pathname.startsWith('/accountsV2/')) return json(res, [])
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found', path: url.pathname, body }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`mock JD on http://127.0.0.1:${port}`)
})
