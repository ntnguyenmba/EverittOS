import type { SupabaseClient } from '@supabase/supabase-js';
import { canAccessFinancialTracking, FINANCIAL_TRACKING_MIN_PLAN } from '@/lib/finance-access';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

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
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return { ok: false, status: ctx.status, error: ctx.error };
  }

  if (!isManagerRole(ctx.workspace.role)) {
    return { ok: false, status: 403, error: 'Permission denied' };
  }

  const { plan } = await resolveOrganizationPlan(ctx.supabase, ctx.userId);
  if (!canAccessFinancialTracking(plan)) {
    return {
      ok: false,
      status: 403,
      error: `${FINANCIAL_TRACKING_MIN_PLAN} plan or higher is required for financial tracking.`
    };
  }

  return {
    ok: true,
    supabase: ctx.supabase,
    userId: ctx.userId,
    organizationId: ctx.workspace.organizationId,
    canManage: isManagerRole(ctx.workspace.role)
  };
}
