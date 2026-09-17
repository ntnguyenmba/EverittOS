import { NextResponse } from 'next/server';
import { verifyAiRequest } from '@/lib/ai-gate';
import { getAiUsageStats } from '@/lib/ai-server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getAiApiCopy } from '@/lib/i18n/ai-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const c = getAiApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  const orgCtx = await fetchOrganizationContextForUser(supabase, user.id);
  const { plan } = await resolveOrganizationPlan(supabase, user.id);

  if (!orgCtx) {
    return NextResponse.json({ hasAccess: false, plan, usage: null, canViewBilling: false });
  }

  const stats = await getAiUsageStats(admin, orgCtx.organizationId, plan);
  const gate = await verifyAiRequest(supabase, admin, user.id);

  return NextResponse.json({
    hasAccess: gate.ok,
    plan,
    usage: stats,
    canViewBilling: canManageBilling(normalizeRole(orgCtx.role))
  });
}
