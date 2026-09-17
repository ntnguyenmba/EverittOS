import type { SupabaseClient } from '@supabase/supabase-js';
import { canAccessFinancialTracking, FINANCIAL_TRACKING_MIN_PLAN } from '@/lib/finance-access';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import type { Locale } from '@/lib/i18n/config';
import { getFinanceApiCopy } from '@/lib/i18n/finance-api-copy';

export type FinanceApiContext =
  | {
      ok: true;
      supabase: SupabaseClient;
      userId: string;
      organizationId: string;
      canManage: boolean;
    }
  | { ok: false; status: number; error: string };

export async function requireFinanceApiAccess(locale: Locale = 'en'): Promise<FinanceApiContext> {
  const copy = getFinanceApiCopy(locale);
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return { ok: false, status: ctx.status, error: ctx.error };
  }

  if (!isManagerRole(ctx.workspace.role)) {
    return { ok: false, status: 403, error: copy.permissionDenied };
  }

  const { plan } = await resolveOrganizationPlan(ctx.supabase, ctx.userId);
  if (!canAccessFinancialTracking(plan)) {
    return {
      ok: false,
      status: 403,
      error: copy.planRequired(FINANCIAL_TRACKING_MIN_PLAN)
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
