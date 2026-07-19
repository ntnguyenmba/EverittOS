/**
 * Google Play Developer API purchase verification.
 * Service-account JSON must remain server-only (env GOOGLE_PLAY_SERVICE_ACCOUNT_JSON).
 */
import { createSign, createPrivateKey } from 'node:crypto';
import {
  googlePlayPackageName,
  planFromGoogleProductId
} from '@/lib/billing/product-catalog';
import { normalizeStoreStatus, type SubscriptionStatus } from '@/lib/billing/subscription-status';

export type GoogleVerifiedPurchase = {
  productId: string;
  plan: 'pro' | 'business';
  purchaseToken: string;
  packageName: string;
  orderId: string | null;
  environment: string;
  purchaseDate: string | null;
  expiresDate: string | null;
  autoRenewing: boolean | null;
  acknowledgementState: number | null;
  status: SubscriptionStatus;
  raw: Record<string, unknown>;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '';
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(): Promise<string> {
  const sa = loadServiceAccount();
  if (!sa) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured.');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })
  ).toString('base64url');
  const signingInput = `${header}.${claim}`;
  const key = createPrivateKey(sa.private_key);
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${signer.sign(key).toString('base64url')}`;

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error('Unable to obtain Google Play API access token.');
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Google access token missing.');
  return json.access_token;
}

function msToIso(ms: string | number | undefined | null): string | null {
  if (ms === undefined || ms === null || ms === '') return null;
  const n = typeof ms === 'string' ? Number(ms) : ms;
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

function mapGoogleSubscriptionState(raw: Record<string, unknown>): SubscriptionStatus {
  // subscriptionsv2 uses subscriptionState; v1 uses paymentState / cancelReason / expiry
  const state = String(raw.subscriptionState || '').toUpperCase();
  if (state) {
    const map: Record<string, SubscriptionStatus> = {
      SUBSCRIPTION_STATE_ACTIVE: 'active',
      SUBSCRIPTION_STATE_PENDING: 'pending',
      SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace_period',
      SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
      SUBSCRIPTION_STATE_PAUSED: 'paused',
      SUBSCRIPTION_STATE_CANCELED: 'cancelled',
      SUBSCRIPTION_STATE_EXPIRED: 'expired',
      SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'cancelled'
    };
    if (map[state]) return map[state];
  }

  if (raw.cancelReason != null && Number(raw.expiryTimeMillis) > Date.now()) return 'cancelled';
  if (Number(raw.paymentState) === 0) return 'pending';
  if (Number(raw.expiryTimeMillis) < Date.now()) return 'expired';
  return 'active';
}

export async function verifyGooglePlaySubscription(input: {
  productId: string;
  purchaseToken: string;
}): Promise<GoogleVerifiedPurchase> {
  const productId = input.productId.trim();
  const purchaseToken = input.purchaseToken.trim();
  if (!productId || !purchaseToken) {
    throw new Error('productId and purchaseToken are required.');
  }

  const plan = planFromGoogleProductId(productId);
  if (!plan) {
    throw new Error('Unknown Google Play product ID.');
  }

  const packageName = googlePlayPackageName();
  const token = await getGoogleAccessToken();

  // Prefer subscriptions v2 (token-based); fall back to v1 product endpoint.
  const v2Url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  let raw: Record<string, unknown> | null = null;
  const v2Res = await fetch(v2Url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (v2Res.ok) {
    raw = (await v2Res.json()) as Record<string, unknown>;
  } else {
    const v1Url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const v1Res = await fetch(v1Url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!v1Res.ok) {
      throw new Error('Google Play purchase verification failed.');
    }
    raw = (await v1Res.json()) as Record<string, unknown>;
  }

  const lineItems = Array.isArray(raw.lineItems) ? (raw.lineItems as Array<Record<string, unknown>>) : [];
  const firstItem = lineItems[0] || {};
  const verifiedProductId = String(firstItem.productId || productId);
  if (planFromGoogleProductId(verifiedProductId) !== plan) {
    // Allow when client product matches catalog and v2 omits line item product
    if (verifiedProductId !== productId && planFromGoogleProductId(verifiedProductId)) {
      throw new Error('Google Play product mismatch.');
    }
  }

  const status = mapGoogleSubscriptionState(raw);
  const expiresDate =
    msToIso(firstItem.expiryTime as string | undefined) ||
    msToIso(raw.expiryTime as string | undefined) ||
    msToIso(raw.expiryTimeMillis as string | number | undefined);

  return {
    productId: verifiedProductId || productId,
    plan,
    purchaseToken,
    packageName,
    orderId: (raw.latestOrderId as string) || (raw.orderId as string) || null,
    environment: String(raw.testPurchase ? 'sandbox' : 'production'),
    purchaseDate:
      msToIso(raw.startTime as string | undefined) ||
      msToIso(raw.startTimeMillis as string | number | undefined),
    expiresDate,
    autoRenewing:
      typeof raw.autoRenewing === 'boolean'
        ? raw.autoRenewing
        : typeof firstItem.autoRenewingPlan === 'object'
          ? true
          : null,
    acknowledgementState:
      typeof raw.acknowledgementState === 'number'
        ? raw.acknowledgementState
        : typeof raw.acknowledgementState === 'string'
          ? raw.acknowledgementState.includes('ACKNOWLEDGED')
            ? 1
            : 0
          : null,
    status: normalizeStoreStatus(status),
    raw
  };
}

/** Acknowledge a verified Google Play subscription via the Developer API. */
export async function acknowledgeGooglePlaySubscription(input: {
  productId: string;
  purchaseToken: string;
}): Promise<void> {
  const packageName = googlePlayPackageName();
  const token = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName
  )}/purchases/subscriptions/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(
    input.purchaseToken
  )}:acknowledge`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}',
    cache: 'no-store'
  });
  if (!res.ok && res.status !== 400) {
    // 400 often means already acknowledged
    throw new Error('Unable to acknowledge Google Play purchase.');
  }
}

export function decodeGooglePlayRtdnMessage(body: unknown): {
  packageName: string | null;
  purchaseToken: string | null;
  subscriptionId: string | null;
  notificationType: number | null;
  messageId: string | null;
} {
  const envelope = body as {
    message?: { data?: string; messageId?: string; message_id?: string };
  };
  const messageId = envelope.message?.messageId || envelope.message?.message_id || null;
  const dataB64 = envelope.message?.data;
  if (!dataB64) {
    return {
      packageName: null,
      purchaseToken: null,
      subscriptionId: null,
      notificationType: null,
      messageId
    };
  }
  const decoded = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8')) as {
    packageName?: string;
    subscriptionNotification?: {
      purchaseToken?: string;
      subscriptionId?: string;
      notificationType?: number;
    };
  };
  return {
    packageName: decoded.packageName || null,
    purchaseToken: decoded.subscriptionNotification?.purchaseToken || null,
    subscriptionId: decoded.subscriptionNotification?.subscriptionId || null,
    notificationType: decoded.subscriptionNotification?.notificationType ?? null,
    messageId
  };
}
