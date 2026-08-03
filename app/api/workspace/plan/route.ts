import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import {
  fetchProfileByUserId,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { normalizeRole } from '@/lib/roles';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, json } = await createRouteHandlerSupabase();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profileRead = await fetchProfileByUserId(supabase, user.id);
  if (profileRead.error) {
    return json({ error: profileRead.error, code: 'profile_read_failed' }, { status: 500 });
  }

  const profile = profileRead.profile;
  const rawProfilePlan = profile?.plan?.trim() || null;
  const rawSubscriptionStatus = profile?.subscription_status?.trim() || null;

  const [profilePlan, subscriptionStatus, orgPlan, orgContext] = await Promise.all([
    resolveProfilePlan(supabase, user.id, profile),
    resolveProfileSubscriptionStatus(supabase, user.id, profile),
    resolveOrganizationPlan(supabase, user.id),
    fetchOrganizationContextForUser(supabase, user.id)
  ]);

  const workspaceRole = normalizeRole(orgContext?.role || profile?.role || 'owner');
  const billingPlan: EverittosPlan = normalizePlan(orgPlan.plan);
  const organizationPlan: EverittosPlan = normalizePlan(orgPlan.plan);
  const profilePlanResolved: EverittosPlan = profilePlan;

  return json({
    profilePlan: profilePlanResolved,
    subscriptionStatus,
    billingPlan,
    organizationPlan,
    role: workspaceRole,
    rawProfilePlan,
    rawSubscriptionStatus,
    organizationId: orgPlan.organizationId,
    ownerUserId: orgPlan.ownerUserId,
    schemaFallback: profileRead.usedCoreSelect || undefined
  });
}
