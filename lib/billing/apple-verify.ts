/**
 * Apple App Store Server API helpers and JWS transaction verification.
 * Credentials stay server-only.
 */
import { createPublicKey, createVerify, createSign, createPrivateKey } from 'node:crypto';
import { appleBundleId, planFromAppleProductId } from '@/lib/billing/product-catalog';
import { normalizeStoreStatus, type SubscriptionStatus } from '@/lib/billing/subscription-status';

export type AppleVerifiedTransaction = {
  productId: string;
  plan: 'pro' | 'business';
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  environment: string;
  purchaseDate: string | null;
  expiresDate: string | null;
  revocationDate: string | null;
  autoRenewStatus: boolean | null;
  status: SubscriptionStatus;
  signedTransaction: string;
};

type AppleJwksKey = {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
};

function base64UrlToBuffer(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function decodeJwsPayload<T>(jws: string): { header: Record<string, unknown>; payload: T; signingInput: string; signature: Buffer } {
  const parts = jws.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Apple JWS format.');
  }
  const header = JSON.parse(base64UrlToBuffer(parts[0]).toString('utf8')) as Record<string, unknown>;
  const payload = JSON.parse(base64UrlToBuffer(parts[1]).toString('utf8')) as T;
  return {
    header,
    payload,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlToBuffer(parts[2])
  };
}

async function fetchApplePublicKey(kid: string): Promise<AppleJwksKey> {
  const res = await fetch('https://appleid.apple.com/auth/keys', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Unable to load Apple JWKS.');
  }
  const json = (await res.json()) as { keys?: AppleJwksKey[] };
  const key = (json.keys || []).find((k) => k.kid === kid);
  if (!key) {
    throw new Error('Apple signing key not found for kid.');
  }
  return key;
}

function verifyEs256(signingInput: string, signature: Buffer, jwk: AppleJwksKey): boolean {
  const keyObject = createPublicKey({ key: jwk as unknown as string, format: 'jwk' });
  const verifier = createVerify('SHA256');
  verifier.update(signingInput);
  verifier.end();
  return verifier.verify(keyObject, signature);
}

function applePrivateKeyPem(): string | null {
  const raw = process.env.APPLE_IN_APP_PURCHASE_PRIVATE_KEY || '';
  if (!raw.trim()) return null;
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function appleApiBase(): string {
  const env = (process.env.APPLE_ENVIRONMENT || 'Production').toLowerCase();
  if (env === 'sandbox') {
    return 'https://api.storekit-sandbox.itunes.apple.com';
  }
  return 'https://api.storekit.itunes.apple.com';
}

/** Create a short-lived App Store Server API JWT. */
export function createAppleServerApiToken(): string | null {
  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = applePrivateKeyPem();
  const bundleId = appleBundleId();
  if (!issuerId || !keyId || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 50 * 60,
      aud: 'appstoreconnect-v1',
      bid: bundleId
    })
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(privateKey);
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(key).toString('base64url');
  return `${signingInput}.${signature}`;
}

export async function fetchAppleSubscriptionStatus(
  originalTransactionId: string
): Promise<Record<string, unknown> | null> {
  const token = createAppleServerApiToken();
  if (!token) return null;
  const url = `${appleApiBase()}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

type AppleTxPayload = {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  bundleId?: string;
  environment?: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  type?: string;
};

function msToIso(ms: number | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function deriveAppleStatus(payload: AppleTxPayload): SubscriptionStatus {
  if (payload.revocationDate) return 'revoked';
  if (payload.expiresDate && payload.expiresDate < Date.now()) return 'expired';
  return 'active';
}

/**
 * Verify a StoreKit signed transaction JWS and map it to an EverittOS plan.
 * Rejects unknown product IDs and mismatched bundle IDs.
 */
export async function verifyAppleSignedTransaction(
  signedTransaction: string
): Promise<AppleVerifiedTransaction> {
  const jws = signedTransaction.trim();
  if (!jws) throw new Error('signedTransaction is required.');

  const { header, payload, signingInput, signature } = decodeJwsPayload<AppleTxPayload>(jws);
  const kid = String(header.kid || '');
  if (!kid) throw new Error('Apple JWS missing kid.');

  // Prefer x5c chain when present (App Store Server Notifications / StoreKit).
  const x5c = Array.isArray(header.x5c) ? (header.x5c as string[]) : [];
  let verified = false;
  if (x5c[0]) {
    const certPem = `-----BEGIN CERTIFICATE-----\n${x5c[0].match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
    const keyObject = createPublicKey(certPem);
    const verifier = createVerify('SHA256');
    verifier.update(signingInput);
    verifier.end();
    verified = verifier.verify(keyObject, signature);
  } else {
    const jwk = await fetchApplePublicKey(kid);
    verified = verifyEs256(signingInput, signature, jwk);
  }

  if (!verified) {
    throw new Error('Apple transaction signature verification failed.');
  }

  const expectedBundle = appleBundleId();
  if (payload.bundleId && payload.bundleId !== expectedBundle) {
    throw new Error('Apple transaction bundle ID mismatch.');
  }

  const productId = String(payload.productId || '');
  const plan = planFromAppleProductId(productId);
  if (!plan) {
    throw new Error('Unknown Apple product ID.');
  }

  const originalTransactionId = String(payload.originalTransactionId || payload.transactionId || '');
  const transactionId = String(payload.transactionId || '');
  if (!originalTransactionId || !transactionId) {
    throw new Error('Apple transaction identifiers missing.');
  }

  return {
    productId,
    plan,
    transactionId,
    originalTransactionId,
    bundleId: String(payload.bundleId || expectedBundle),
    environment: String(payload.environment || process.env.APPLE_ENVIRONMENT || 'Production'),
    purchaseDate: msToIso(payload.purchaseDate),
    expiresDate: msToIso(payload.expiresDate),
    revocationDate: msToIso(payload.revocationDate),
    autoRenewStatus: null,
    status: deriveAppleStatus(payload),
    signedTransaction: jws
  };
}

export type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
    bundleId?: string;
    environment?: string;
  };
};

export async function decodeAppleNotification(signedPayload: string): Promise<{
  notification: AppleNotificationPayload;
  transaction: AppleVerifiedTransaction | null;
}> {
  const { header, payload, signingInput, signature } = decodeJwsPayload<AppleNotificationPayload>(signedPayload);
  const x5c = Array.isArray(header.x5c) ? (header.x5c as string[]) : [];
  if (!x5c[0]) throw new Error('Apple notification missing certificate chain.');
  const certPem = `-----BEGIN CERTIFICATE-----\n${x5c[0].match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
  const keyObject = createPublicKey(certPem);
  const verifier = createVerify('SHA256');
  verifier.update(signingInput);
  verifier.end();
  if (!verifier.verify(keyObject, signature)) {
    throw new Error('Apple notification signature verification failed.');
  }

  let transaction: AppleVerifiedTransaction | null = null;
  const signedTx = payload.data?.signedTransactionInfo;
  if (signedTx) {
    transaction = await verifyAppleSignedTransaction(signedTx);
    if (payload.notificationType === 'REFUND' || payload.notificationType === 'REVOKE') {
      transaction = { ...transaction, status: normalizeStoreStatus('revoked') };
    } else if (payload.notificationType === 'EXPIRED') {
      transaction = { ...transaction, status: 'expired' };
    } else if (payload.notificationType === 'DID_FAIL_TO_RENEW') {
      transaction = {
        ...transaction,
        status: payload.subtype === 'GRACE_PERIOD' ? 'grace_period' : 'billing_retry'
      };
    }
  }

  return { notification: payload, transaction };
}
