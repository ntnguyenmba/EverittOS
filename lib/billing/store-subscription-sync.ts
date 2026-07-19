/**
 * Persist verified Apple/Google subscriptions and recompute entitlements.
 */
import type { createAdminSupabase } from '@/lib/supabase-admin';
import { resolveOrganizationEntitlement } from '@/lib/billing/entitlements';
import type { AppleVerifiedTransaction } from '@/lib/billing/apple-verify';
import type { GoogleVerifiedPurchase } from '@/lib/billing/google-verify';
import type { OrganizationEntitlement } from '@/lib/billing/entitlements';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

export async function upsertAppleSubscription(
  admin: AdminClient,
  input: {
    organizationId: string;
    userId: string;
    verified: AppleVerifiedTransaction;
  }
): Promise<{ subscriptionId: string; entitlement: OrganizationEntitlement }> {
  const { organizationId, userId, verified } = input;

  // Prevent attaching the same Apple subscription to a different organization.
  const { data: existing } = await admin
    .from('billing_subscriptions')
    .select('id, organization_id')
    .eq('platform', 'apple')
    .eq('original_transaction_id', verified.originalTransactionId)
    .maybeSingle();

  if (existing?.organization_id && existing.organization_id !== organizationId) {
    throw Object.assign(new Error('This Apple subscription is already linked to another workspace.'), {
      code: 'subscription_owned'
    });
  }

  const now = new Date().toISOString();
  const row = {
    organization_id: organizationId,
    user_id: userId,
    platform: 'apple' as const,
    product_id: verified.productId,
    plan: verified.plan,
    external_subscription_id: verified.originalTransactionId,
    original_transaction_id: verified.originalTransactionId,
    purchase_token: null,
    status: verified.status,
    environment: verified.environment,
    started_at: verified.purchaseDate,
    expires_at: verified.expiresDate,
    cancelled_at: null,
    revoked_at: verified.revocationDate,
    grace_period_expires_at: null,
    auto_renews: verified.autoRenewStatus,
    last_verified_at: now,
    updated_at: now,
    raw_payload: {
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId
    }
  };

  let subscriptionId = existing?.id || '';
  if (existing?.id) {
    const { error } = await admin.from('billing_subscriptions').update(row).eq('id', existing.id);
    if (error) throw error;
    subscriptionId = existing.id;
  } else {
    const { data, error } = await admin.from('billing_subscriptions').insert(row).select('id').single();
    if (error) throw error;
    subscriptionId = data.id;
  }

  const entitlement = await resolveOrganizationEntitlement(admin, organizationId);
  return { subscriptionId, entitlement };
}

export async function upsertGoogleSubscription(
  admin: AdminClient,
  input: {
    organizationId: string;
    userId: string;
    verified: GoogleVerifiedPurchase;
  }
): Promise<{ subscriptionId: string; entitlement: OrganizationEntitlement }> {
  const { organizationId, userId, verified } = input;

  const { data: existing } = await admin
    .from('billing_subscriptions')
    .select('id, organization_id')
    .eq('platform', 'google')
    .eq('purchase_token', verified.purchaseToken)
    .maybeSingle();

  if (existing?.organization_id && existing.organization_id !== organizationId) {
    throw Object.assign(new Error('This Google Play subscription is already linked to another workspace.'), {
      code: 'subscription_owned'
    });
  }

  const now = new Date().toISOString();
  const row = {
    organization_id: organizationId,
    user_id: userId,
    platform: 'google' as const,
    product_id: verified.productId,
    plan: verified.plan,
    external_subscription_id: verified.orderId,
    original_transaction_id: verified.orderId,
    purchase_token: verified.purchaseToken,
    status: verified.status,
    environment: verified.environment,
    started_at: verified.purchaseDate,
    expires_at: verified.expiresDate,
    cancelled_at: verified.status === 'cancelled' ? now : null,
    revoked_at: verified.status === 'revoked' || verified.status === 'refunded' ? now : null,
    grace_period_expires_at: verified.status === 'grace_period' ? verified.expiresDate : null,
    auto_renews: verified.autoRenewing,
    last_verified_at: now,
    updated_at: now,
    raw_payload: {
      acknowledgementState: verified.acknowledgementState,
      orderId: verified.orderId
    }
  };

  let subscriptionId = existing?.id || '';
  if (existing?.id) {
    const { error } = await admin.from('billing_subscriptions').update(row).eq('id', existing.id);
    if (error) throw error;
    subscriptionId = existing.id;
  } else {
    const { data, error } = await admin.from('billing_subscriptions').insert(row).select('id').single();
    if (error) throw error;
    subscriptionId = data.id;
  }

  const entitlement = await resolveOrganizationEntitlement(admin, organizationId);
  return { subscriptionId, entitlement };
}
