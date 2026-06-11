import { NextResponse } from 'next/server';
import { clientIpFromRequest, checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** Pre-signup rate limit gate. Does not create accounts; signup still uses Supabase Auth directly. */
export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const result = checkRateLimit(rateLimitKey('signup', ip), RATE_LIMITS.signup);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many signup attempts from this network. Wait an hour and try again.',
        title: 'Rate limit exceeded',
        code: 'rate_limit_exceeded'
      },
      { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
    );
  }

  return NextResponse.json({ ok: true });
}
