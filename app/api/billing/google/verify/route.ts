import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling } from '@/lib/roles';
import { resolveWorkspaceRoleForUser, fetchOrganizationContextForUser } from '@/lib/organization-server';
import {
  acknowledgeGooglePlaySubscription,
  verifyGooglePlaySubscription
} from '@/lib/billing/google-verify';
import { upsertGoogleSubscription } from '@/lib/billing/store-subscription-sync';
import { claimBillingEvent } from '@/lib/billing/entitlements';
import { planFromGoogleProductId } from '@/lib/billing/product-catalog';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    purchaseToken?: string;
    productId?: string;
    organizationId?: string;
  };

  const purchaseToken = (body.purchaseToken || '').trim();
  const productId = (body.productId || '').trim();
  if (!purchaseToken || !productId) {
    return NextResponse.json({ error: 'purchaseToken and productId are required.' }, { status: 400 });
  }

  if (!planFromGoogleProductId(productId)) {
    return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = await resolveWorkspaceRoleForUser(supabase, user.id, profile?.role);
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: 'Only workspace owners and admins can purchase for this organization.' }, { status: 403 });
  }

  const orgContext = await fetchOrganizationContextForUser(supabase, user.id);
  const organizationId = (body.organizationId || profile?.organization_id || orgContext?.organizationId || '').trim();
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization is required.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server billing configuration is incomplete.' }, { status: 503 });
  }

  try {
    const verified = await verifyGooglePlaySubscription({ productId, purchaseToken });

    if (verified.status === 'pending') {
      return NextResponse.json({
        ok: false,
        pending: true,
        message: 'Your purchase is pending. Access will activate after Google confirms payment.',
        status: verified.status
      });
    }

    const eventKey = `google:verify:${purchaseToken.slice(0, 64)}:${verified.orderId || 'na'}`;
    await claimBillingEvent(admin, 'google', eventKey, 'client_verify', {
      productId: verified.productId,
      status: verified.status
    }, organizationId);

    const { entitlement } = await upsertGoogleSubscription(admin, {
      organizationId,
      userId: user.id,
      verified
    });

    // Acknowledge only after EverittOS has persisted the verified subscription.
    if (verified.acknowledgementState !== 1) {
      try {
        await acknowledgeGooglePlaySubscription({
          productId: verified.productId,
          purchaseToken
        });
      } catch (ackError) {
        console.error('GOOGLE_ACK_FAILED', (ackError as Error).message);
      }
    }

    return NextResponse.json({
      ok: true,
      plan: entitlement.plan,
      source: entitlement.source,
      status: entitlement.status,
      expiresAt: entitlement.expiresAt,
      productId: verified.productId
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'subscription_owned') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('GOOGLE_VERIFY_FAILED', err.message);
    return NextResponse.json({ error: 'Unable to verify Google Play purchase.' }, { status: 400 });
  }
}
