import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { normalizePlan } from '@/lib/everittos-plans';
import { validatePlanAction, type PlanResource } from '@/lib/plan-validate';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { resource?: PlanResource };
  const resource = body.resource;
  if (!resource) {
    return NextResponse.json({ error: 'resource is required' }, { status: 400 });
  }

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan = normalizePlan(profile?.plan);
  const org = await fetchOrganizationContextForUser(supabase, user.id);
  const counts = await fetchUsageCounts(user.id, org?.organizationId);

  const countMap = {
    jobs: counts.jobs,
    photos: counts.photos,
    customers: counts.customers,
    reports: counts.reports,
    workers: counts.workers,
    teamMembers: counts.teamMembers,
    locations: counts.locations
  };

  const result = validatePlanAction({ plan, resource, currentCount: countMap[resource] });
  return NextResponse.json(result);
}
