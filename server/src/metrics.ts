let moverLastTickAt: number | null = null
let moverLastMoved = 0
let moverLastFailed = 0
let jdErrorCount = 0
let authLoginOk = 0
let authLoginFail = 0

export function noteMoverTick(result: { moved: number; failed: number }): void {
  moverLastTickAt = Date.now()
  moverLastMoved = result.moved
  moverLastFailed = result.failed
}

export function noteJdError(): void {
  jdErrorCount += 1
}

export function noteAuthLogin(ok: boolean): void {
  if (ok) authLoginOk += 1
  else authLoginFail += 1
}

export function snapshotMetrics(extra: Record<string, number | string | null>): Record<string, number | string | null> {
  return {
    ...extra,
    mover_last_tick_at: moverLastTickAt,
    mover_last_moved: moverLastMoved,
    mover_last_failed: moverLastFailed,
    jd_errors: jdErrorCount,
    auth_login_ok: authLoginOk,
    auth_login_fail: authLoginFail,
  }
}

export function metricsText(extra: Record<string, number | string | null>): string {
  const snap = snapshotMetrics(extra)
  return Object.entries(snap)
    .map(([k, v]) => `${k} ${v ?? ''}`)
    .join('\n') + '\n'
}
