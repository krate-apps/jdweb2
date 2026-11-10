import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { metricsText, noteAuthLogin, noteJdError, noteMoverTick, snapshotMetrics } from './metrics.js'

describe('metrics', () => {
  it('accumulates counters into snapshot and text', () => {
    noteMoverTick({ moved: 2, failed: 1 })
    noteJdError()
    noteJdError()
    noteAuthLogin(true)
    noteAuthLogin(false)

    const snap = snapshotMetrics({ uptime_s: 10 })
    assert.equal(snap.uptime_s, 10)
    assert.equal(snap.mover_last_moved, 2)
    assert.equal(snap.mover_last_failed, 1)
    assert.equal(snap.jd_errors, 2)
    assert.equal(snap.auth_login_ok, 1)
    assert.equal(snap.auth_login_fail, 1)
    assert.ok(typeof snap.mover_last_tick_at === 'number')

    const text = metricsText({ uptime_s: 10 })
    assert.match(text, /jd_errors 2/)
    assert.match(text, /auth_login_ok 1/)
    assert.match(text, /\n$/)
  })
})
