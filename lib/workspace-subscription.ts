import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import {
  fetchProfileByUserId,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { subscriptionAccess } from '@/lib/subscription-access';

export type WorkspaceSubscription = {
  userId: string;
  organizationId: string | null;
  ownerUserId: string | null;
  plan: EverittosPlan;
  profilePlan: EverittosPlan;
  organizationPlan: EverittosPlan;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paidFeaturesUnlocked: boolean;
};

/** Single source of truth for workspace billing state used by feature gates. */
export async function getWorkspaceSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkspaceSubscription> {
  const profileRead = await fetchProfileByUserId(supabase, userId);
  const profile = profileRead.profile;
  const org = await resolveOrganizationPlan(supabase, userId);

  const profilePlan = await resolveProfilePlan(supabase, userId, profile);
  const subscriptionStatus = await resolveProfileSubscriptionStatus(supabase, userId, profile);
  const organizationPlan = org.plan;
  const effectivePlan = organizationPlan;

  const ownerId = org.ownerUserId || userId;
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', ownerId)
    .maybeSingle();

  const { data: subscriptionRow } = await supabase
    .from('everittos_subscriptions')
    .select(
      'stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end, status, plan'
    )
    .eq('user_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const access = subscriptionAccess(effectivePlan, subscriptionStatus);

  return {
    userId,
    organizationId: org.organizationId,
    ownerUserId: org.ownerUserId,
    plan: effectivePlan,
    profilePlan,
    organizationPlan,
    subscriptionStatus,
    stripeCustomerId: ownerProfile?.stripe_customer_id || null,
    stripeSubscriptionId: subscriptionRow?.stripe_subscription_id || null,
    stripePriceId: subscriptionRow?.stripe_price_id || null,
    currentPeriodEnd: subscriptionRow?.current_period_end || null,
    cancelAtPeriodEnd: Boolean(subscriptionRow?.cancel_at_period_end),
    paidFeaturesUnlocked: effectivePlan !== 'free' && access.ok
  };
}

export function isPaidPlanActive(plan: string | null | undefined, status: string | null | undefined): boolean {
  const normalizedPlan = normalizePlan(plan);
  if (normalizedPlan === 'free') return false;
  return subscriptionAccess(normalizedPlan, status).ok;
}
