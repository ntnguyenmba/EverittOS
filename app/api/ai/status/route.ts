import { NextResponse } from 'next/server';
import { AI_REQUIRED_PLAN, planHasAiAccess } from '@/lib/ai-features';
import { verifyAiRequest } from '@/lib/ai-gate';
import { getAiUsageStats } from '@/lib/ai-server';
import { openAiConfigured } from '@/lib/ai-config';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const configured = openAiConfigured();
  const allowed = planHasAiAccess(plan);

  const admin = createAdminSupabase();
  let usage = null;
  let gateStatus: { ok: boolean; code?: string; message?: string } = { ok: allowed && configured };

  if (admin && org) {
    if (allowed) {
      const gate = await verifyAiRequest(supabase, admin, user.id);
      gateStatus = gate.ok
        ? { ok: true }
        : { ok: false, code: gate.code, message: gate.message };
      if (gate.ok || gate.code === 'rate_limited') {
        usage = await getAiUsageStats(admin, org.organizationId, plan);
      }
    }
  }

  return NextResponse.json({
    allowed: allowed && gateStatus.ok,
    configured,
    plan,
    requiredPlan: AI_REQUIRED_PLAN,
    locked: !allowed,
    lockedMessage: allowed
      ? null
      : 'Ask Everitt is available on Business and Enterprise plans.',
    gate: gateStatus,
    usage
  });
}
