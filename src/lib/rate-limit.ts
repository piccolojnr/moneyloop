// Simple in-memory sliding window rate limiter.
//
// NOTE: Limits are enforced per-process. On Vercel with multiple concurrent
// serverless instances each instance tracks its own window, so the effective
// limit across all instances is limit × N. For a strict global limit swap the
// store for @upstash/ratelimit backed by Redis.

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Prune expired entries to prevent unbounded memory growth on long-lived processes.
function prune() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

/**
 * Check (and increment) the rate limit counter for a given key.
 *
 * @param key      Unique identifier — e.g. IP address or `user:<id>`
 * @param limit    Maximum number of allowed requests in the window
 * @param windowMs Window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastPrune > PRUNE_INTERVAL_MS) {
    prune();
    lastPrune = now;
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/** Extract the caller's IP from a Next.js route handler request. */
export function getRequestIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Build a standard 429 response with a Retry-After header. */
export function rateLimitExceededResponse(resetAt: number): Response {
  const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
