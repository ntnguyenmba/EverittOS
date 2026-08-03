import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { fetchProfileByUserId, resolveProfilePlan } from '@/lib/profile-query';

async function readWorkspaceBillingPlan(
  supabase: SupabaseClient,
  organizationId: string
): Promise<EverittosPlan | null> {
  const { data: entitlement } = await supabase
    .from('account_entitlements')
    .select('plan, status, expires_at')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (entitlement?.plan && entitlement.status === 'active') {
    const expiresAt = entitlement.expires_at ? new Date(entitlement.expires_at).getTime() : null;
    if (!expiresAt || expiresAt > Date.now()) {
      const plan = normalizePlan(entitlement.plan);
      if (plan !== 'free') return plan;
    }
  }

  const { data: subscription } = await supabase
    .from('everittos_subscriptions')
    .select('plan, status, current_period_end')
    .eq('organization_id', organizationId)
    .neq('plan', 'free')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscription?.plan) {
    const status = String(subscription.status || '').toLowerCase();
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end).getTime()
      : null;
    const grantsAccess =
      status === 'active' ||
      status === 'trialing' ||
      status === 'past_due' ||
      status === 'unpaid' ||
      (status === 'canceled' && Boolean(periodEnd && periodEnd > Date.now()));

    if (grantsAccess) {
      const plan = normalizePlan(subscription.plan);
      if (plan !== 'free') return plan;
    }
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', organizationId)
    .maybeSingle();

  if (organization?.plan) {
    const plan = normalizePlan(organization.plan);
    if (plan !== 'free') return plan;
  }

  return null;
}

/** Billing limits follow the workspace billing records, then the organization owner profile. */
export async function resolveOrganizationPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ plan: EverittosPlan; organizationId: string | null; ownerUserId: string | null }> {
  const org = await fetchOrganizationContextForUser(supabase, userId);
  if (!org) {
    const { profile } = await fetchProfileByUserId(supabase, userId);
    return {
      plan: await resolveProfilePlan(supabase, userId, profile),
      organizationId: null,
      ownerUserId: userId
    };
  }

  const workspacePlan = await readWorkspaceBillingPlan(supabase, org.organizationId);
  if (workspacePlan) {
    return {
      plan: workspacePlan,
      organizationId: org.organizationId,
      ownerUserId: org.ownerUserId
    };
  }

  const { profile: ownerProfile } = await fetchProfileByUserId(supabase, org.ownerUserId);

  return {
    plan: await resolveProfilePlan(supabase, org.ownerUserId, ownerProfile),
    organizationId: org.organizationId,
    ownerUserId: org.ownerUserId
  };
}
