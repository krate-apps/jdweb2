import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeBasePath } from './config.js'

describe('normalizeBasePath', () => {
  it('returns empty for root or blank', () => {
    assert.equal(normalizeBasePath(''), '')
    assert.equal(normalizeBasePath('/'), '')
    assert.equal(normalizeBasePath('   '), '')
  })

  it('adds a leading slash and strips trailing slashes', () => {
    assert.equal(normalizeBasePath('alice/jdweb'), '/alice/jdweb')
    assert.equal(normalizeBasePath('/alice/jdweb/'), '/alice/jdweb')
    assert.equal(normalizeBasePath('/jdweb///'), '/jdweb')
  })
})
