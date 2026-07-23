import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { QUICKBOOKS_STATE_MAX_AGE_MS, quickbooksStateSecret } from '@/lib/quickbooks/config';

export type QuickBooksOAuthStatePayload = {
  userId: string;
  organizationId: string;
  issuedAt: number;
  nonce: string;
};

function encodePayload(payload: QuickBooksOAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encoded: string): QuickBooksOAuthStatePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<QuickBooksOAuthStatePayload>;
    if (!parsed.userId || !parsed.organizationId || !parsed.issuedAt || !parsed.nonce) return null;
    return {
      userId: String(parsed.userId),
      organizationId: String(parsed.organizationId),
      issuedAt: Number(parsed.issuedAt),
      nonce: String(parsed.nonce)
    };
  } catch {
    return null;
  }
}

export function createQuickBooksOAuthState(userId: string, organizationId: string): string {
  const secret = quickbooksStateSecret();
  if (!secret) {
    throw new Error('QUICKBOOKS_STATE_SECRET is not configured.');
  }

  const payload: QuickBooksOAuthStatePayload = {
    userId,
    organizationId,
    issuedAt: Date.now(),
    nonce: randomBytes(16).toString('hex')
  };
  const body = encodePayload(payload);
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyQuickBooksOAuthState(
  state: string,
  maxAgeMs = QUICKBOOKS_STATE_MAX_AGE_MS
): QuickBooksOAuthStatePayload | null {
  const secret = quickbooksStateSecret();
  if (!secret || !state || !state.includes('.')) return null;

  const lastDot = state.lastIndexOf('.');
  const body = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  if (!body || !sig) return null;

  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const payload = decodePayload(body);
  if (!payload) return null;
  if (!Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt >= maxAgeMs) return null;
  if (payload.issuedAt > Date.now() + 60_000) return null;

  return payload;
}
