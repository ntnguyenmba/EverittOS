import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import {
  fetchProfileByUserId,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { normalizeRole } from '@/lib/roles';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationEntitlement } from '@/lib/billing/entitlements';

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
  const orgContext = await fetchOrganizationContextForUser(supabase, user.id);
  const organizationId = orgContext?.organizationId || profile?.organization_id || null;

  if (organizationId) {
    const admin = createAdminSupabase();
    if (!admin) {
      return json({ error: 'Server billing configuration is incomplete.' }, { status: 503 });
    }

    try {
      await resolveOrganizationEntitlement(admin, organizationId);
    } catch (error) {
      console.error('WORKSPACE_PLAN_ENTITLEMENT_REFRESH_FAILED', {
        userId: user.id,
        organizationId,
        error: error instanceof Error ? error.message : 'unknown'
      });
      return json({ error: 'Unable to refresh subscription status.' }, { status: 500 });
    }
  }

  const refreshedProfileRead = await fetchProfileByUserId(supabase, user.id);
  if (refreshedProfileRead.error) {
    return json({ error: refreshedProfileRead.error, code: 'profile_refresh_failed' }, { status: 500 });
  }

  const refreshedProfile = refreshedProfileRead.profile;
  const rawProfilePlan = refreshedProfile?.plan?.trim() || null;
  const rawSubscriptionStatus = refreshedProfile?.subscription_status?.trim() || null;

  const [profilePlan, subscriptionStatus, orgPlan] = await Promise.all([
    resolveProfilePlan(supabase, user.id, refreshedProfile),
    resolveProfileSubscriptionStatus(supabase, user.id, refreshedProfile),
    resolveOrganizationPlan(supabase, user.id)
  ]);

  const workspaceRole = normalizeRole(orgContext?.role || refreshedProfile?.role || 'owner');
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
    schemaFallback: refreshedProfileRead.usedCoreSelect || undefined
  });
}
