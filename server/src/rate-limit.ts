interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Sliding fixed-window limiter. Returns true if the call is allowed. */
export function rateLimitAllow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count += 1
  return true
}

export function clearRateLimits(): void {
  buckets.clear()
}
