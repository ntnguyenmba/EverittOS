import { NextResponse } from 'next/server';
import { normalizePlan } from '@/lib/everittos-plans';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getMiscApiCopy } from '@/lib/i18n/misc-api-copy';
import type { Locale } from '@/lib/i18n/config';

const PLAN_MRR: Record<string, number> = { pro: 9, business: 39, growth: 399, enterprise: 799 };

function monthKey(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === 'es' ? 'es-US' : locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short' });
}

function lastSixMonths(): Date[] {
  const months: Date[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  return months;
}

export async function GET(request: Request) {
  const locale = localeFromRequest(request);
  const c = getMiscApiCopy(locale);
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const orgId = org.organizationId;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: ownerProfile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan = normalizePlan(ownerProfile?.plan);

  const [membersRes,jobsRes,jobsMonthRes,reportsRes,jobsWithReportsRes,assignedJobsRes,workersRes,portalEventsRes,subsRes] = await Promise.all([
    supabase.from('organization_members').select('user_id, active, created_at').eq('organization_id', orgId),
    supabase.from('jobs').select('id, created_at, status').eq('organization_id', orgId),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', monthStart.toISOString()),
    supabase.from('job_reports').select('id, job_id').eq('organization_id', orgId),
    supabase.from('jobs').select('id').eq('organization_id', orgId).not('status', 'eq', 'cancelled'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).not('assigned_to', 'is', null),
    supabase.from('workers').select('id').eq('organization_id', orgId),
    supabase.from('product_events').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('event_name', 'client_portal_view').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('profiles').select('plan, subscription_status').eq('organization_id', orgId)
  ]);

  const members = membersRes.data || [];
  const jobs = jobsRes.data || [];
  const activeUsers = members.filter((m) => m.active).length;
  const workerCount = (workersRes.data || []).length || 1;
  const assignedJobs = assignedJobsRes.count || 0;
  const totalJobs = jobs.length || 1;
  const technicianUtilizationPct = Math.min(100, Math.round((assignedJobs / (workerCount * Math.max(totalJobs, 1))) * 100));

  const jobsWithReports = new Set((reportsRes.data || []).map((r) => r.job_id));
  const eligibleJobs = jobsWithReportsRes.data || [];
  const reportCompletionRatePct = eligibleJobs.length === 0 ? 0 : Math.round((jobsWithReports.size / eligibleJobs.length) * 100);
  const mrrUsd = PLAN_MRR[plan] || 0;

  const subscriptionBreakdown: Record<string, number> = {};
  (subsRes.data || []).forEach((p) => { const key = normalizePlan(p.plan); subscriptionBreakdown[key] = (subscriptionBreakdown[key] || 0) + 1; });

  const months = lastSixMonths();
  const jobsTrend = months.map((m) => ({ label: monthKey(m, locale), value: jobs.filter((j) => { if (!j.created_at) return false; const d = new Date(j.created_at); return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); }).length }));
  const revenueTrend = months.map((m) => ({ label: monthKey(m, locale), value: mrrUsd > 0 ? mrrUsd : 0 }));
  const growthTrend = months.map((m) => ({ label: monthKey(m, locale), value: members.filter((member) => { if (!member.created_at) return false; const d = new Date(member.created_at); return d <= new Date(m.getFullYear(), m.getMonth() + 1, 0); }).length }));

  const prevMonthJobs = jobsTrend[jobsTrend.length - 2]?.value || 0;
  const currentMonthJobs = jobsTrend[jobsTrend.length - 1]?.value || 0;
  const revenueGrowthPct = prevMonthJobs === 0 ? 0 : Math.round(((currentMonthJobs - prevMonthJobs) / prevMonthJobs) * 100);
  const hasActivity = (jobsMonthRes.count || 0) > 0 || jobs.length > 0 || activeUsers > 1 || (portalEventsRes.count || 0) > 0 || jobsWithReports.size > 0;

  return NextResponse.json({ mrrUsd, arrUsd: mrrUsd * 12, activeUsers, monthlyJobs: jobsMonthRes.count || 0, technicianUtilizationPct, revenueGrowthPct, clientPortalViews30d: portalEventsRes.count || 0, reportCompletionRatePct, subscriptionBreakdown, jobsTrend, revenueTrend: mrrUsd > 0 ? revenueTrend : [], growthTrend, hasActivity });
}
