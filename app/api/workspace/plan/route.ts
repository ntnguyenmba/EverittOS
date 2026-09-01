import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import {
  fetchProfileByUserId,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { normalizeRole } from '@/lib/roles';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';

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

  // Resolve the selected workspace from the secure active-org cookie first.
  // This is critical for users who are Owner in their own company but Client
  // or Worker in another company. The selected membership, not profile.role,
  // must drive the signed-in shell and RoleHomeGuard.
  const orgContext = await fetchOrganizationContextForRequest(supabase, user.id);
  const selectedOrganizationId = orgContext?.organizationId || null;

  const [profilePlan, subscriptionStatus, orgPlan] = await Promise.all([
    resolveProfilePlan(supabase, user.id, profile),
    resolveProfileSubscriptionStatus(supabase, user.id, profile),
    resolveOrganizationPlan(supabase, user.id, selectedOrganizationId)
  ]);

  // Authorization fails closed. A real selected organization membership wins;
  // profile.role is only a legacy fallback when no workspace can be resolved.
  const workspaceRole = normalizeRole(orgContext?.role || profile?.role || 'employee');
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
    organizationId: selectedOrganizationId || orgPlan.organizationId,
    ownerUserId: orgContext?.ownerUserId || orgPlan.ownerUserId,
    schemaFallback: profileRead.usedCoreSelect || undefined
  }, { headers: { 'Cache-Control': 'no-store' } });
}
