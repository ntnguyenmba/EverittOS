import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling } from '@/lib/roles';
import { resolveWorkspaceRoleForUser, fetchOrganizationContextForUser } from '@/lib/organization-server';
import { verifyAppleSignedTransaction } from '@/lib/billing/apple-verify';
import { upsertAppleSubscription } from '@/lib/billing/store-subscription-sync';
import { claimBillingEvent } from '@/lib/billing/entitlements';
import { planFromAppleProductId } from '@/lib/billing/product-catalog';

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
    signedTransaction?: string;
    productId?: string;
    organizationId?: string;
  };

  const signedTransaction = (body.signedTransaction || '').trim();
  if (!signedTransaction) {
    return NextResponse.json({ error: 'signedTransaction is required.' }, { status: 400 });
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
  if (profile?.organization_id && body.organizationId && body.organizationId !== profile.organization_id) {
    return NextResponse.json({ error: 'Organization mismatch.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server billing configuration is incomplete.' }, { status: 503 });
  }

  try {
    const verified = await verifyAppleSignedTransaction(signedTransaction);

    if (body.productId && body.productId !== verified.productId) {
      return NextResponse.json({ error: 'Product ID mismatch.' }, { status: 400 });
    }
    if (!planFromAppleProductId(verified.productId)) {
      return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
    }

    const eventKey = `apple:verify:${verified.transactionId}`;
    await claimBillingEvent(admin, 'apple', eventKey, 'client_verify', {
      originalTransactionId: verified.originalTransactionId,
      productId: verified.productId
    }, organizationId);

    const { entitlement } = await upsertAppleSubscription(admin, {
      organizationId,
      userId: user.id,
      verified
    });

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
    console.error('APPLE_VERIFY_FAILED', err.message);
    return NextResponse.json({ error: 'Unable to verify Apple purchase.' }, { status: 400 });
  }
}
