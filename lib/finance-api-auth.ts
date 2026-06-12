import type { SupabaseClient } from '@supabase/supabase-js';
import { canAccessFinancialTracking, FINANCIAL_TRACKING_MIN_PLAN } from '@/lib/finance-access';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export type FinanceApiContext =
  | {
      ok: true;
      supabase: SupabaseClient;
      userId: string;
      organizationId: string;
      canManage: boolean;
    }
  | { ok: false; status: number; error: string };

export async function requireFinanceApiAccess(): Promise<FinanceApiContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const org = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) {
    return { ok: false, status: 403, error: 'Permission denied' };
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!canAccessFinancialTracking(plan)) {
    return {
      ok: false,
      status: 403,
      error: `${FINANCIAL_TRACKING_MIN_PLAN} plan or higher is required for financial tracking.`
    };
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
    organizationId: org.organizationId,
    canManage: isManagerRole(org.role)
  };
}
