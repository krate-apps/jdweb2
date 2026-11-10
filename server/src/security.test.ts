import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertSafeJdApiUrl,
  assertSafeWebhookUrl,
  isLoopbackAddress,
  isPrivateOrLoopbackHost,
} from './security.js'
import { rateLimitAllow, clearRateLimits } from './rate-limit.js'

describe('isLoopbackAddress', () => {
  it('accepts loopback peers only', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true)
    assert.equal(isLoopbackAddress('::1'), true)
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true)
    assert.equal(isLoopbackAddress('localhost'), true)
    assert.equal(isLoopbackAddress('10.0.0.1'), false)
    assert.equal(isLoopbackAddress(''), false)
  })
})

describe('isPrivateOrLoopbackHost', () => {
  it('accepts loopback and private ranges', () => {
    assert.equal(isPrivateOrLoopbackHost('127.0.0.1'), true)
    assert.equal(isPrivateOrLoopbackHost('localhost'), true)
    assert.equal(isPrivateOrLoopbackHost('10.0.0.2'), true)
    assert.equal(isPrivateOrLoopbackHost('192.168.1.1'), true)
    assert.equal(isPrivateOrLoopbackHost('172.16.0.1'), true)
    assert.equal(isPrivateOrLoopbackHost('::1'), true)
    assert.equal(isPrivateOrLoopbackHost('host.docker.internal'), true)
  })

  it('rejects public hosts', () => {
    assert.equal(isPrivateOrLoopbackHost('8.8.8.8'), false)
    assert.equal(isPrivateOrLoopbackHost('example.com'), false)
  })
})

describe('assertSafeJdApiUrl', () => {
  it('accepts private http URLs', () => {
    assert.equal(assertSafeJdApiUrl('http://127.0.0.1:49247/'), 'http://127.0.0.1:49247')
  })

  it('rejects public and invalid URLs', () => {
    assert.throws(() => assertSafeJdApiUrl('http://example.com:3128'), /jd_api_url_not_private/)
    assert.throws(() => assertSafeJdApiUrl('not-a-url'), /invalid_jd_api_url/)
    assert.throws(() => assertSafeJdApiUrl('ftp://127.0.0.1:3128'), /invalid_jd_api_url/)
  })
})

describe('assertSafeWebhookUrl', () => {
  it('accepts public https URLs', () => {
    assert.equal(assertSafeWebhookUrl('https://hooks.example.com/x'), 'https://hooks.example.com/x')
  })

  it('rejects private and metadata hosts', () => {
    assert.throws(() => assertSafeWebhookUrl('http://127.0.0.1/hook'), /webhook_url_not_public/)
    assert.throws(() => assertSafeWebhookUrl('http://10.0.0.1/hook'), /webhook_url_not_public/)
    assert.throws(() => assertSafeWebhookUrl('http://169.254.169.254/latest'), /webhook_url_not_public/)
    assert.throws(() => assertSafeWebhookUrl('ftp://example.com/x'), /invalid_url/)
  })
})

describe('rateLimitAllow', () => {
  it('allows up to the limit then blocks', () => {
    clearRateLimits()
    assert.equal(rateLimitAllow('t', 2, 60_000), true)
    assert.equal(rateLimitAllow('t', 2, 60_000), true)
    assert.equal(rateLimitAllow('t', 2, 60_000), false)
  })
})
