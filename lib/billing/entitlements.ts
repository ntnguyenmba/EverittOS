/**
 * Authoritative organization entitlement resolver.
 * Combines verified Stripe, Apple, Google, and manual subscriptions.
 * Never trusts client-supplied plan or purchase success flags.
 */
import type { createAdminSupabase } from '@/lib/supabase-admin';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeStripeStatus } from '@/lib/stripe-subscription';
import {
  planRank,
  statusGrantsAccess,
  normalizeStoreStatus,
  type EntitlementSource,
  type SubscriptionStatus
} from '@/lib/billing/subscription-status';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

export type OrganizationEntitlement = {
  plan: EverittosPlan;
  source: EntitlementSource;
  status: SubscriptionStatus | 'free';
  expiresAt: string | null;
  billingSubscriptionId: string | null;
  sources: Array<{
    platform: EntitlementSource;
    plan: EverittosPlan;
    status: SubscriptionStatus | 'free';
    expiresAt: string | null;
  }>;
};

type Candidate = {
  plan: EverittosPlan;
  source: EntitlementSource;
  status: SubscriptionStatus;
  expiresAt: string | null;
  billingSubscriptionId: string | null;
  grantsAccess: boolean;
};

function freeEntitlement(): OrganizationEntitlement {
  return {
    plan: 'free',
    source: 'free',
    status: 'free',
    expiresAt: null,
    billingSubscriptionId: null,
    sources: []
  };
}

function stripeStatusToStore(status: string): SubscriptionStatus {
  const s = normalizeStripeStatus(status);
  switch (s) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'billing_retry';
    case 'canceled':
      return 'cancelled';
    case 'unpaid':
      return 'on_hold';
    case 'paused':
      return 'paused';
    case 'incomplete':
    case 'incomplete_expired':
      return 'pending';
    default:
      return 'expired';
  }
}

/**
 * Resolve the effective plan for an organization from verified billing records.
 *
 * Precedence:
 * 1. Ignore revoked / refunded / expired / invalid rows
 * 2. Keep active, trialing, grace_period, and cancelled-but-unexpired access
 * 3. When multiple valid entitlements exist, choose the highest plan
 * 4. Fall back to Free
 */
export async function resolveOrganizationEntitlement(
  admin: AdminClient,
  organizationId: string
): Promise<OrganizationEntitlement> {
  if (!organizationId) return freeEntitlement();

  const candidates: Candidate[] = [];

  const { data: storeRows } = await admin
    .from('billing_subscriptions')
    .select(
      'id, platform, plan, status, expires_at, organization_id, revoked_at'
    )
    .eq('organization_id', organizationId);

  for (const row of storeRows || []) {
    const plan = normalizePlan(row.plan);
    if (plan === 'free') continue;
    const status = normalizeStoreStatus(row.status);
    if (row.revoked_at) {
      candidates.push({
        plan,
        source: (row.platform as EntitlementSource) || 'manual',
        status: 'revoked',
        expiresAt: row.expires_at || null,
        billingSubscriptionId: row.id,
        grantsAccess: false
      });
      continue;
    }
    const grantsAccess = statusGrantsAccess(status, row.expires_at);
    candidates.push({
      plan,
      source: (row.platform as EntitlementSource) || 'manual',
      status,
      expiresAt: row.expires_at || null,
      billingSubscriptionId: row.id,
      grantsAccess
    });
  }

  const { data: stripeRows } = await admin
    .from('everittos_subscriptions')
    .select('id, plan, status, current_period_end, organization_id')
    .eq('organization_id', organizationId);

  for (const row of stripeRows || []) {
    const plan = normalizePlan(row.plan);
    if (plan === 'free') continue;
    const status = stripeStatusToStore(String(row.status || ''));
    const expiresAt = row.current_period_end
      ? new Date(row.current_period_end).toISOString()
      : null;
    candidates.push({
      plan,
      source: 'stripe',
      status,
      expiresAt,
      billingSubscriptionId: null,
      grantsAccess: statusGrantsAccess(status, expiresAt)
    });
  }

  // Manual promotional override on organizations.plan with account_entitlements source=manual
  const { data: manualEntitlement } = await admin
    .from('account_entitlements')
    .select('plan, source, status, expires_at, billing_subscription_id')
    .eq('organization_id', organizationId)
    .eq('source', 'manual')
    .maybeSingle();

  if (manualEntitlement) {
    const plan = normalizePlan(manualEntitlement.plan);
    const status = normalizeStoreStatus(manualEntitlement.status);
    candidates.push({
      plan,
      source: 'manual',
      status,
      expiresAt: manualEntitlement.expires_at || null,
      billingSubscriptionId: manualEntitlement.billing_subscription_id || null,
      grantsAccess: plan !== 'free' && statusGrantsAccess(status, manualEntitlement.expires_at)
    });
  }

  const valid = candidates.filter((c) => c.grantsAccess && c.plan !== 'free');
  const sources = candidates.map((c) => ({
    platform: c.source,
    plan: c.plan,
    status: c.status,
    expiresAt: c.expiresAt
  }));

  if (!valid.length) {
    const resolved = freeEntitlement();
    resolved.sources = sources;
    await persistEntitlementCache(admin, organizationId, resolved);
    return resolved;
  }

  valid.sort((a, b) => {
    const planDiff = planRank(b.plan) - planRank(a.plan);
    if (planDiff !== 0) return planDiff;
    const aExp = a.expiresAt ? Date.parse(a.expiresAt) : Number.POSITIVE_INFINITY;
    const bExp = b.expiresAt ? Date.parse(b.expiresAt) : Number.POSITIVE_INFINITY;
    return bExp - aExp;
  });

  const winner = valid[0];
  const resolved: OrganizationEntitlement = {
    plan: winner.plan,
    source: winner.source,
    status: winner.status,
    expiresAt: winner.expiresAt,
    billingSubscriptionId: winner.billingSubscriptionId,
    sources
  };

  await persistEntitlementCache(admin, organizationId, resolved);
  await mirrorPlanToOrgAndOwner(admin, organizationId, resolved);

  return resolved;
}

async function persistEntitlementCache(
  admin: AdminClient,
  organizationId: string,
  entitlement: OrganizationEntitlement
): Promise<void> {
  const now = new Date().toISOString();
  await admin.from('account_entitlements').upsert(
    {
      organization_id: organizationId,
      plan: entitlement.plan,
      source: entitlement.source,
      status: entitlement.status === 'free' ? 'expired' : entitlement.status,
      expires_at: entitlement.expiresAt,
      billing_subscription_id: entitlement.billingSubscriptionId,
      last_resolved_at: now,
      updated_at: now
    },
    { onConflict: 'organization_id' }
  );
}

/** Keep organizations.plan and owner profile in sync with resolved entitlement. */
async function mirrorPlanToOrgAndOwner(
  admin: AdminClient,
  organizationId: string,
  entitlement: OrganizationEntitlement
): Promise<void> {
  const subscriptionStatus =
    entitlement.plan === 'free'
      ? 'free'
      : entitlement.status === 'cancelled'
        ? 'canceled'
        : entitlement.status === 'billing_retry'
          ? 'past_due'
          : entitlement.status === 'grace_period'
            ? 'past_due'
            : entitlement.status === 'active' || entitlement.status === 'trialing'
              ? entitlement.status
              : entitlement.status === 'expired' || entitlement.status === 'revoked'
                ? 'inactive'
                : 'active';

  await admin
    .from('organizations')
    .update({ plan: entitlement.plan })
    .eq('id', organizationId);

  const { data: org } = await admin
    .from('organizations')
    .select('owner_user_id')
    .eq('id', organizationId)
    .maybeSingle();

  if (org?.owner_user_id) {
    await admin
      .from('profiles')
      .update({
        plan: entitlement.plan,
        subscription_status: subscriptionStatus
      })
      .eq('id', org.owner_user_id);
  }
}

export async function claimBillingEvent(
  admin: AdminClient,
  platform: 'apple' | 'google' | 'stripe' | 'manual',
  eventId: string,
  eventType: string,
  payload?: unknown,
  organizationId?: string | null,
  subscriptionId?: string | null
): Promise<'claimed' | 'duplicate'> {
  const { error } = await admin.from('billing_events').insert({
    platform,
    event_id: eventId,
    event_type: eventType,
    organization_id: organizationId || null,
    subscription_id: subscriptionId || null,
    payload: payload ?? null
  });

  if (error) {
    if (String(error.code) === '23505' || /duplicate|unique/i.test(error.message || '')) {
      return 'duplicate';
    }
    throw error;
  }
  return 'claimed';
}
