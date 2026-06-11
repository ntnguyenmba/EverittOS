import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitKey,
  rateLimitResponse,
  RATE_LIMITS
} from '@/lib/rate-limit';

type RateLimitRule = {
  match: (pathname: string, method: string) => boolean;
  prefix: string;
  config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];
  identifier?: (request: NextRequest) => string;
};

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    match: (pathname, method) => pathname === '/api/auth/login' && method === 'POST',
    prefix: 'login',
    config: RATE_LIMITS.login
  },
  {
    match: (pathname, method) => pathname === '/api/auth/reset-password' && method === 'POST',
    prefix: 'forgot',
    config: RATE_LIMITS.forgotPassword
  },
  {
    match: (pathname, method) => pathname === '/api/auth/signup-rate-limit' && method === 'POST',
    prefix: 'signup',
    config: RATE_LIMITS.signup
  },
  {
    match: (pathname, method) => pathname === '/api/auth/setup' && method === 'POST',
    prefix: 'auth-setup',
    config: RATE_LIMITS.authSetup
  },
  {
    match: (pathname, method) => pathname === '/api/account/request-deletion' && method === 'POST',
    prefix: 'account-deletion',
    config: RATE_LIMITS.accountDeletion
  },
  {
    match: (pathname, method) => pathname === '/api/team/invite' && method === 'POST',
    prefix: 'team-invite',
    config: RATE_LIMITS.teamInvite
  },
  {
    match: (pathname, method) => pathname === '/api/clients/grant-access' && method === 'POST',
    prefix: 'client-grant',
    config: RATE_LIMITS.clientGrant
  },
  {
    match: (pathname, method) => pathname.startsWith('/api/v1/') && method !== 'OPTIONS',
    prefix: 'api-v1',
    config: RATE_LIMITS.apiV1
  }
];

export function enforceRateLimit(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  for (const rule of RATE_LIMIT_RULES) {
    if (!rule.match(pathname, method)) continue;

    const ip = clientIpFromRequest(request);
    const identifier = rule.identifier ? rule.identifier(request) : ip;
    const result = checkRateLimit(rateLimitKey(rule.prefix, identifier), rule.config);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Wait a moment and try again.',
          title: 'Rate limit exceeded',
          code: 'rate_limit_exceeded'
        },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfterSeconds) }
        }
      );
    }
  }

  return null;
}

/** Standalone helper for route handlers that need custom identifiers. */
export { checkRateLimit, clientIpFromRequest, rateLimitKey, rateLimitResponse, RATE_LIMITS };
