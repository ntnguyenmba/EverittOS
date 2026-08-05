import { NextResponse } from 'next/server';
import {
  countValidJobsInPeriod,
  type JobCountRow
} from '@/lib/dashboard-metrics';
import { limitsForPlan } from '@/lib/everittos-limits';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).advancedReporting) {
    return NextResponse.json({ error: 'Analytics requires Business or higher.' }, { status: 403 });
  }

  const orgId = org.organizationId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  let jobsRes = await supabase
    .from('jobs')
    .select(
      'id, status, completed_at, start_date, scheduled_start, due_date, created_at, is_skipped, recurring_series_id, occurrence_date'
    )
    .eq('organization_id', orgId);
  if (jobsRes.error && /column|schema cache|does not exist/i.test(jobsRes.error.message || '')) {
    jobsRes = await supabase
      .from('jobs')
      .select('id, status, completed_at, start_date, scheduled_start, due_date, created_at')
      .eq('organization_id', orgId);
  }

  const [events, reports, members, settings] = await Promise.all([
    supabase.from('product_events').select('event_name, created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('job_reports').select('id, created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('organization_members').select('id, created_at').eq('organization_id', orgId).eq('active', true),
    supabase.from('organization_settings').select('onboarding_completed, onboarding_step').eq('organization_id', orgId).maybeSingle()
  ]);

  const jobRows = (jobsRes.data || []) as JobCountRow[];
  // Same shared job-count engine as the dashboard (calendar month + all time).
  const jobsThisMonth = countValidJobsInPeriod(jobRows, 'month');
  const jobsAllTime = countValidJobsInPeriod(jobRows, 'all_time');

  const eventRows = events.data || [];
  const eventCounts: Record<string, number> = {};
  eventRows.forEach((e) => {
    eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
  });

  const adoptionMetrics = [
    { label: 'Onboarding completion', value: settings.data?.onboarding_completed ? 100 : Math.round(((settings.data?.onboarding_step || 0) / 7) * 100) },
    { label: 'Jobs this month', value: jobsThisMonth },
    { label: 'Reports generated (30d)', value: reports.data?.length || 0 },
    { label: 'Active team members', value: members.data?.length || 0 },
    { label: 'Team invites (30d)', value: eventCounts.team_invited || 0 },
    { label: 'Client portal usage (30d)', value: eventCounts.client_portal_view || 0 }
  ];

  const growthMetrics = [
    { label: 'Signups tracked', value: eventCounts.signup || 0 },
    { label: 'Company setup events', value: eventCounts.company_created || 0 },
    { label: 'Subscription upgrades', value: eventCounts.subscription_upgraded || 0 },
    { label: 'Onboarding steps logged', value: eventCounts.onboarding_step || 0 }
  ];

  const usageMetrics = [
    { label: 'Photos uploaded', value: eventCounts.photo_uploaded || 0 },
    { label: 'Customers created', value: eventCounts.customer_created || 0 },
    { label: 'Jobs created', value: jobsAllTime },
    { label: 'Reports generated', value: eventCounts.report_generated || 0 }
  ];

  return NextResponse.json({
    adoptionMetrics,
    growthMetrics,
    usageMetrics,
    eventCounts
  });
}
