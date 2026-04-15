// ============================================================
// server/src/rateLimiter.ts — Per-socket rate limiting
// ============================================================

const RATE_LIMIT = 30;          // max events per window
const RATE_WINDOW_MS = 5_000;   // 5 seconds

interface RateEntry {
  count: number;
  resetAt: number;
}

const entries = new Map<string, RateEntry>();

/**
 * Check if a socket has exceeded the rate limit.
 * Returns true if the request is allowed, false if rate-limited.
 */
export function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let entry = entries.get(socketId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    entries.set(socketId, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

/** Clean up rate limit entry for a disconnected socket */
export function cleanupRateLimit(socketId: string): void {
  entries.delete(socketId);
}
