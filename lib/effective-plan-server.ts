import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { syncActiveStripeSubscriptionForUser } from '@/lib/stripe-billing-sync';

export type EffectivePlanResult = {
  plan: EverittosPlan;
  organizationId: string | null;
  ownerUserId: string | null;
  syncedFromStripe: boolean;
};

async function ownerStripeSyncHint(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  ownerUserId: string,
  organizationId: string | null
): Promise<{ email: string } | null> {
  const { data: owner } = await admin
    .from('profiles')
    .select('email, stripe_customer_id, plan')
    .eq('id', ownerUserId)
    .maybeSingle();

  const email = owner?.email?.trim().toLowerCase();
  if (!email) return null;

  if (normalizePlan(owner?.plan) !== 'free') return null;

  if (owner?.stripe_customer_id?.trim()) {
    return { email };
  }

  const { data: ownerSub } = await admin
    .from('everittos_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', ownerUserId)
    .not('stripe_subscription_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ownerSub?.stripe_subscription_id) {
    return { email };
  }

  if (organizationId) {
    const { data: orgSub } = await admin
      .from('everittos_subscriptions')
      .select('stripe_subscription_id, status')
      .eq('organization_id', organizationId)
      .not('stripe_subscription_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orgSub?.stripe_subscription_id) {
      return { email };
    }
  }

  return null;
}

/**
 * Organization owner plan used for feature gates. Optionally re-syncs Stripe when
 * the owner profile is still on Free but a paid subscription exists in Stripe.
 */
export async function resolveEffectiveOrganizationPlan(
  supabase: SupabaseClient,
  userId: string,
  options: { attemptStripeSync?: boolean } = { attemptStripeSync: true }
): Promise<EffectivePlanResult> {
  let resolved = await resolveOrganizationPlan(supabase, userId);
  let syncedFromStripe = false;

  if (!options.attemptStripeSync || resolved.plan !== 'free') {
    return { ...resolved, syncedFromStripe };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const admin = createAdminSupabase();
  if (!stripeKey || !admin) {
    return { ...resolved, syncedFromStripe };
  }

  const ownerUserId = resolved.ownerUserId || userId;
  const syncHint = await ownerStripeSyncHint(admin, ownerUserId, resolved.organizationId);
  if (!syncHint) {
    return { ...resolved, syncedFromStripe };
  }

  try {
    const stripe = new Stripe(stripeKey);
    const result = await syncActiveStripeSubscriptionForUser(admin, stripe, {
      userId: ownerUserId,
      email: syncHint.email,
      workspaceId: resolved.organizationId
    });

    if (result.synced) {
      syncedFromStripe = true;
      resolved = await resolveOrganizationPlan(supabase, userId);
    }
  } catch {
    // Keep the resolved Free plan; worker save logs will show the block reason.
  }

  return { ...resolved, syncedFromStripe };
}
