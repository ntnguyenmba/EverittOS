import { NextResponse } from 'next/server';
import { openAiConfigured } from '@/lib/ai-config';
import { aiMonthlyCap, countAiGenerationsThisMonth } from '@/lib/ai-server';
import { canAccessFeature } from '@/lib/plan-access';
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
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const allowed = canAccessFeature(plan, 'aiAccess');
  const configured = openAiConfigured();

  let used = 0;
  const cap = aiMonthlyCap(plan);
  const admin = createAdminSupabase();
  if (admin && allowed) {
    used = await countAiGenerationsThisMonth(admin, org.organizationId);
  }

  return NextResponse.json({
    allowed,
    configured,
    plan,
    requiredPlan: 'business',
    monthlyCap: cap,
    monthlyUsed: used,
    unlimited: cap < 0
  });
}
