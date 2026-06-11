/**
 * In-memory sliding-window rate limiter for API routes and middleware.
 * Note: On multi-instance serverless hosts, use a shared store (e.g. Upstash Redis) for strict global limits.
 */

export type RateLimitConfig = {
  /** Max requests allowed in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

/** Remove expired buckets periodically to avoid unbounded memory growth. */
function pruneExpired(now: number) {
  if (store.size < 5000) return;
  store.forEach((bucket, key) => {
    if (bucket.resetAt <= now) store.delete(key);
  });
}

export function checkRateLimit(key: string, config: RateLimitConfig, now = Date.now()): RateLimitResult {
  pruneExpired(now);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: config.limit - existing.count, retryAfterSeconds: 0 };
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  forgotPassword: { limit: 5, windowMs: 60 * 60 * 1000 },
  accountDeletion: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  accountExport: { limit: 5, windowMs: 60 * 60 * 1000 },
  accountPrivacy: { limit: 30, windowMs: 60 * 1000 },
  accountConsent: { limit: 10, windowMs: 60 * 60 * 1000 },
  teamInvite: { limit: 20, windowMs: 60 * 60 * 1000 },
  clientGrant: { limit: 20, windowMs: 60 * 60 * 1000 },
  apiV1: { limit: 120, windowMs: 60 * 1000 },
  authSetup: { limit: 30, windowMs: 60 * 60 * 1000 },
  generalApi: { limit: 60, windowMs: 60 * 1000 }
} as const satisfies Record<string, RateLimitConfig>;

export function rateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Wait a moment and try again.',
      title: 'Rate limit exceeded',
      code: 'rate_limit_exceeded'
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds)
      }
    }
  );
}
