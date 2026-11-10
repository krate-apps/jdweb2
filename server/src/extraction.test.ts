import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { archivesListReady, extractionBlocksMover, extractionStateFromStatus } from './extraction.js'

describe('extractionStateFromStatus', () => {
  it('detects extracting, password, failed, and ok', () => {
    assert.equal(extractionStateFromStatus(undefined), 'none')
    assert.equal(extractionStateFromStatus('Extracting…', false), 'extracting')
    assert.equal(extractionStateFromStatus('Extracting…', true), 'ok')
    assert.equal(extractionStateFromStatus('Wrong password'), 'needPassword')
    assert.equal(extractionStateFromStatus('Extract failed'), 'failed')
    assert.equal(extractionStateFromStatus('Finished'), 'none')
  })
})

describe('extractionBlocksMover', () => {
  it('blocks unsafe states only', () => {
    assert.equal(extractionBlocksMover('none'), false)
    assert.equal(extractionBlocksMover('ok'), false)
    assert.equal(extractionBlocksMover('extracting'), true)
    assert.equal(extractionBlocksMover('needPassword'), true)
    assert.equal(extractionBlocksMover('failed'), true)
  })
})

describe('archivesListReady', () => {
  it('is ready only when no archives remain', () => {
    assert.equal(archivesListReady([]), true)
    assert.equal(archivesListReady(null), true)
    assert.equal(archivesListReady([{ archiveId: 'a' }]), false)
  })
})
