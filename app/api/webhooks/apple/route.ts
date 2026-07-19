import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { decodeAppleNotification } from '@/lib/billing/apple-verify';
import { claimBillingEvent, resolveOrganizationEntitlement } from '@/lib/billing/entitlements';
import { upsertAppleSubscription } from '@/lib/billing/store-subscription-sync';

export const runtime = 'nodejs';

/**
 * App Store Server Notifications v2.
 * Verifies the signed payload, upserts subscription state, recomputes entitlement.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { signedPayload?: string };
  const signedPayload = (body.signedPayload || '').trim();
  if (!signedPayload) {
    return NextResponse.json({ error: 'signedPayload required' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  try {
    const { notification, transaction } = await decodeAppleNotification(signedPayload);
    const eventId = notification.notificationUUID || `apple:${Date.now()}`;
    const claim = await claimBillingEvent(
      admin,
      'apple',
      eventId,
      notification.notificationType || 'unknown',
      { subtype: notification.subtype || null }
    );
    if (claim === 'duplicate') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!transaction) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const { data: existing } = await admin
      .from('billing_subscriptions')
      .select('id, organization_id, user_id')
      .eq('platform', 'apple')
      .eq('original_transaction_id', transaction.originalTransactionId)
      .maybeSingle();

    if (!existing?.organization_id) {
      // Notification for a purchase not yet linked; store is still verified later via client verify.
      return NextResponse.json({ ok: true, pendingLink: true });
    }

    await upsertAppleSubscription(admin, {
      organizationId: existing.organization_id,
      userId: existing.user_id || existing.organization_id,
      verified: transaction
    });

    await resolveOrganizationEntitlement(admin, existing.organization_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('APPLE_WEBHOOK_FAILED', (error as Error).message);
    return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
  }
}
