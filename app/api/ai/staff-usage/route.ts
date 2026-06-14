import { NextResponse } from 'next/server';
import { getStaffAiUsageSummary, STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD } from '@/lib/ai-usage-events';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Staff AI budget summary for owners/admins (Billing / Settings). */
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

  const summary = await getStaffAiUsageSummary(admin, org.organizationId);

  return NextResponse.json({
    ...summary,
    staffBudgetCapUsd: STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD,
    searchDoesNotCountAsAi: true
  });
}
