import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { googleCalendarClientSecret } from '@/lib/google-calendar-config';

type OAuthStatePayload = {
  userId: string;
  organizationId: string;
  ts: number;
  nonce: string;
};

function stateSecret(): string {
  return (
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    googleCalendarClientSecret() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

function encodePayload(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encoded: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (!parsed.userId || !parsed.organizationId || !parsed.ts || !parsed.nonce) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createGoogleOAuthState(userId: string, organizationId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    organizationId,
    ts: Date.now(),
    nonce: randomBytes(16).toString('hex')
  };
  const body = encodePayload(payload);
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGoogleOAuthState(state: string, maxAgeMs = 15 * 60 * 1000): OAuthStatePayload | null {
  const secret = stateSecret();
  if (!secret || !state.includes('.')) return null;

  const [body, sig] = state.split('.');
  if (!body || !sig) return null;

  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const payload = decodePayload(body);
  if (!payload) return null;
  if (Date.now() - payload.ts > maxAgeMs) return null;

  return payload;
}
