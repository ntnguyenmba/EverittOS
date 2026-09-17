import { NextResponse } from 'next/server';
import {
  getStaffAiUsageSummary,
  STAFF_DAILY_AI_PROMPT_LIMIT,
  STAFF_MONTHLY_AI_PROMPT_LIMIT
} from '@/lib/ai-usage-events';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getAiApiCopy } from '@/lib/i18n/ai-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Staff AI usage summary for owners/admins (Billing / Settings). */
export async function GET(request: Request) {
  const locale = localeFromRequest(request);
  const c = getAiApiCopy(locale);
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: c.noWorkspace }, { status: 403 });
  }

  const role = normalizeRole(org.role);
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const summary = await getStaffAiUsageSummary(admin, org.organizationId, plan);

  return NextResponse.json({
    ...summary,
    staffDailyPromptCap: STAFF_DAILY_AI_PROMPT_LIMIT,
    staffMonthlyPromptCap: STAFF_MONTHLY_AI_PROMPT_LIMIT,
    searchDoesNotCountAsAi: true
  });
}
