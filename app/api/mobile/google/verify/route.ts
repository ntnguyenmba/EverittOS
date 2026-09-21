import { NextResponse } from 'next/server';
import { getGooglePublisherAccessToken } from '@/lib/billing/google-verify';

export const runtime = 'nodejs';

const APPS: Record<string, { oneTime: Set<string>; subscriptions: Set<string> }> = {
  'com.everittventures.hobbyworth': {
    oneTime: new Set(['com.everittventures.hobbyworth.lifetime', 'hobbyworth_lifetime']),
    subscriptions: new Set()
  },
  'zodiaq.codes.app': {
    oneTime: new Set(['zodiaq.founders.lifetime']),
    subscriptions: new Set([
      'zodiaq.starter.monthly',
      'zodiaq.pro.monthly',
      'zodiaq.family.monthly',
      'zodiaq.professional.monthly'
    ])
  },
  'com.kindwhisper.app': {
    oneTime: new Set(),
    subscriptions: new Set(['com.kindwhisper.app.premium.monthly'])
  },
  'com.everittventures.cyberpfad': {
    oneTime: new Set(['premium_unlock']),
    subscriptions: new Set(['cyberpfad.pro.monthly', 'cyberpfad.pro.annual'])
  }
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    packageName?: string;
    productId?: string;
    purchaseToken?: string;
  };
  const packageName = (body.packageName || '').trim();
  const productId = (body.productId || '').trim();
  const purchaseToken = (body.purchaseToken || '').trim();
  const app = APPS[packageName];

  if (!app || !productId || !purchaseToken) {
    return NextResponse.json({ error: 'Invalid Google Play purchase.' }, { status: 400 });
  }

  const oneTime = app.oneTime.has(productId);
  const subscription = app.subscriptions.has(productId);
  if (!oneTime && !subscription) {
    return NextResponse.json({ error: 'Unknown Google Play product.' }, { status: 400 });
  }

  try {
    const accessToken = await getGooglePublisherAccessToken({
      oidcToken: request.headers.get('x-vercel-oidc-token')
    });

    const url = oneTime
      ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
      : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store'
    });
    const purchase = (await response.json().catch(() => ({}))) as Record<string, any>;

    if (!response.ok) {
      console.error('SHARED_GOOGLE_VERIFY_FAILED', response.status, purchase);
      return NextResponse.json({ error: 'Google Play could not verify this purchase.' }, { status: 402 });
    }

    if (oneTime) {
      const completed = Number(purchase.purchaseState ?? 0) === 0;
      if (!completed) {
        return NextResponse.json({ error: 'Google Play purchase is not completed.' }, { status: 402 });
      }
      return NextResponse.json({ verified: true, orderId: purchase.orderId || null, productId });
    }

    const state = String(purchase.subscriptionState || '');
    const allowedStates = new Set([
      'SUBSCRIPTION_STATE_ACTIVE',
      'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      'SUBSCRIPTION_STATE_CANCELED'
    ]);
    const lineItems = Array.isArray(purchase.lineItems) ? purchase.lineItems : [];
    const matching = lineItems.find((item: any) => item?.productId === productId) || lineItems[0];
    const expiry = matching?.expiryTime ? Date.parse(matching.expiryTime) : NaN;
    const active = allowedStates.has(state) && Number.isFinite(expiry) && expiry > Date.now();

    if (!active) {
      return NextResponse.json({ error: 'Google Play subscription is not active.' }, { status: 402 });
    }

    return NextResponse.json({
      verified: true,
      productId,
      status: state,
      expiresAt: matching?.expiryTime || null,
      orderId: matching?.latestSuccessfulOrderId || null
    });
  } catch (error) {
    console.error('SHARED_GOOGLE_VERIFY_ERROR', (error as Error).message);
    return NextResponse.json({ error: 'Google Play verification is unavailable.' }, { status: 503 });
  }
}
