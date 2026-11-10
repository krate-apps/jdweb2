import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatEta, formatSize, formatSpeed } from './format.ts'

describe('formatSize', () => {
  it('formats bytes and guards invalid input', () => {
    assert.equal(formatSize(null), '—')
    assert.equal(formatSize(-1), '—')
    assert.equal(formatSize(512), '512 B')
    assert.equal(formatSize(2048), '2.0 KB')
    assert.equal(formatSize(10 * 1024), '10 KB')
    assert.equal(formatSize(5 * 1024 * 1024), '5.0 MB')
  })
})

describe('formatSpeed', () => {
  it('appends /s for positive rates', () => {
    assert.equal(formatSpeed(0), '—')
    assert.equal(formatSpeed(null), '—')
    assert.equal(formatSpeed(1024), '1.0 KB/s')
  })
})

describe('formatEta', () => {
  it('renders compact durations', () => {
    assert.equal(formatEta(null), '—')
    assert.equal(formatEta(9), '9s')
    assert.equal(formatEta(65), '1m 5s')
    assert.equal(formatEta(3700), '1h 1m')
  })
})
