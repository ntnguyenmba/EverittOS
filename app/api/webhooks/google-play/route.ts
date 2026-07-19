import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import {
  decodeGooglePlayRtdnMessage,
  verifyGooglePlaySubscription
} from '@/lib/billing/google-verify';
import { claimBillingEvent, resolveOrganizationEntitlement } from '@/lib/billing/entitlements';
import { upsertGoogleSubscription } from '@/lib/billing/store-subscription-sync';
import { googlePlayPackageName } from '@/lib/billing/product-catalog';

export const runtime = 'nodejs';

/**
 * Google Play Real-time Developer Notifications (Pub/Sub push).
 * Never grants/revokes access from notification type alone — always re-queries Play.
 */
export async function POST(request: Request) {
  const verificationToken = process.env.GOOGLE_PLAY_PUBSUB_VERIFICATION_TOKEN;
  if (verificationToken) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (token !== verificationToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const decoded = decodeGooglePlayRtdnMessage(body);

  if (!decoded.purchaseToken || !decoded.subscriptionId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (decoded.packageName && decoded.packageName !== googlePlayPackageName()) {
    return NextResponse.json({ error: 'Package mismatch' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  const eventId =
    decoded.messageId ||
    `google:${decoded.subscriptionId}:${decoded.purchaseToken.slice(0, 32)}:${decoded.notificationType ?? 'x'}`;

  try {
    const claim = await claimBillingEvent(
      admin,
      'google',
      eventId,
      `rtdn_${decoded.notificationType ?? 'unknown'}`,
      decoded
    );
    if (claim === 'duplicate') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const verified = await verifyGooglePlaySubscription({
      productId: decoded.subscriptionId,
      purchaseToken: decoded.purchaseToken
    });

    const { data: existing } = await admin
      .from('billing_subscriptions')
      .select('id, organization_id, user_id')
      .eq('platform', 'google')
      .eq('purchase_token', decoded.purchaseToken)
      .maybeSingle();

    if (!existing?.organization_id) {
      return NextResponse.json({ ok: true, pendingLink: true });
    }

    await upsertGoogleSubscription(admin, {
      organizationId: existing.organization_id,
      userId: existing.user_id || existing.organization_id,
      verified
    });
    await resolveOrganizationEntitlement(admin, existing.organization_id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('GOOGLE_RTDN_FAILED', (error as Error).message);
    return NextResponse.json({ error: 'Unable to process notification' }, { status: 500 });
  }
}
