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

export async function resolveOrganizationEntitlement(
  admin: AdminClient,
  organizationId: string
): Promise<OrganizationEntitlement> {
  if (!organizationId) return freeEntitlement();

  const candidates: Candidate[] = [];

  const { data: storeRows, error: storeError } = await admin
    .from('billing_subscriptions')
    .select('id, platform, plan, status, expires_at, organization_id, revoked_at')
    .eq('organization_id', organizationId);

  if (storeError) throw new Error(`Unable to read store subscriptions: ${storeError.message}`);

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
    candidates.push({
      plan,
      source: (row.platform as EntitlementSource) || 'manual',
      status,
      expiresAt: row.expires_at || null,
      billingSubscriptionId: row.id,
      grantsAccess: statusGrantsAccess(status, row.expires_at)
    });
  }

  const { data: stripeRows, error: stripeError } = await admin
    .from('everittos_subscriptions')
    .select('id, plan, status, current_period_end, organization_id')
    .eq('organization_id', organizationId);

  if (stripeError) throw new Error(`Unable to read Stripe subscriptions: ${stripeError.message}`);

  for (const row of stripeRows || []) {
    const plan = normalizePlan(row.plan);
    if (plan === 'free') continue;
    const status = stripeStatusToStore(String(row.status || ''));
    const expiresAt = row.current_period_end ? new Date(row.current_period_end).toISOString() : null;
    candidates.push({
      plan,
      source: 'stripe',
      status,
      expiresAt,
      billingSubscriptionId: null,
      grantsAccess: statusGrantsAccess(status, expiresAt)
    });
  }

  const { data: manualEntitlement, error: manualError } = await admin
    .from('account_entitlements')
    .select('plan, source, status, expires_at, billing_subscription_id')
    .eq('organization_id', organizationId)
    .eq('source', 'manual')
    .maybeSingle();

  if (manualError) throw new Error(`Unable to read manual entitlement: ${manualError.message}`);

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

  const valid = candidates.filter((candidate) => candidate.grantsAccess && candidate.plan !== 'free');
  const sources = candidates.map((candidate) => ({
    platform: candidate.source,
    plan: candidate.plan,
    status: candidate.status,
    expiresAt: candidate.expiresAt
  }));

  let resolved: OrganizationEntitlement;

  if (!valid.length) {
    resolved = freeEntitlement();
    resolved.sources = sources;
  } else {
    valid.sort((a, b) => {
      const planDiff = planRank(b.plan) - planRank(a.plan);
      if (planDiff !== 0) return planDiff;
      const aExp = a.expiresAt ? Date.parse(a.expiresAt) : Number.POSITIVE_INFINITY;
      const bExp = b.expiresAt ? Date.parse(b.expiresAt) : Number.POSITIVE_INFINITY;
      return bExp - aExp;
    });

    const winner = valid[0];
    resolved = {
      plan: winner.plan,
      source: winner.source,
      status: winner.status,
      expiresAt: winner.expiresAt,
      billingSubscriptionId: winner.billingSubscriptionId,
      sources
    };
  }

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
  const { error } = await admin.from('account_entitlements').upsert(
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

  if (error) throw new Error(`Unable to save entitlement cache: ${error.message}`);
}

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
        : entitlement.status === 'billing_retry' || entitlement.status === 'grace_period'
          ? 'past_due'
          : entitlement.status === 'active' || entitlement.status === 'trialing'
            ? entitlement.status
            : entitlement.status === 'expired' || entitlement.status === 'revoked'
              ? 'inactive'
              : 'active';

  const { data: updatedOrganizations, error: organizationError } = await admin
    .from('organizations')
    .update({ plan: entitlement.plan })
    .eq('id', organizationId)
    .select('id, owner_user_id');

  if (organizationError) {
    throw new Error(`Unable to update organization plan: ${organizationError.message}`);
  }
  if (!updatedOrganizations || updatedOrganizations.length !== 1) {
    throw new Error(`Unable to update organization plan: organization ${organizationId} was not found.`);
  }

  const ownerUserId = updatedOrganizations[0].owner_user_id;
  if (!ownerUserId) {
    throw new Error(`Unable to update owner plan: organization ${organizationId} has no owner.`);
  }

  const { data: updatedProfiles, error: profileError } = await admin
    .from('profiles')
    .update({
      plan: entitlement.plan,
      subscription_status: subscriptionStatus
    })
    .eq('id', ownerUserId)
    .select('id');

  if (profileError) throw new Error(`Unable to update owner plan: ${profileError.message}`);
  if (!updatedProfiles || updatedProfiles.length !== 1) {
    throw new Error(`Unable to update owner plan: profile ${ownerUserId} was not found.`);
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
