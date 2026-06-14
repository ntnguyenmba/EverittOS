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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Staff AI usage summary for owners/admins (Billing / Settings). */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 });
  }

  const role = normalizeRole(org.role);
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
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
