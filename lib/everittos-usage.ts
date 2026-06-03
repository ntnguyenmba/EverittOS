import { supabase } from '@/lib/supabase';
import { limitsForPlan, type PlanLimits } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { formatUsageLabel, limitReached } from '@/lib/plan-limit-utils';

export type UsageCounts = {
  jobs: number;
  photos: number;
  customers: number;
  reports: number;
  workers: number;
};

export async function fetchUsageCounts(userId: string): Promise<UsageCounts> {
  const [jobsRes, photosRes, customersRes, reportsRes, workersRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('status', 'eq', 'cancelled'),
    supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('job_reports').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('workers').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);

  return {
    jobs: jobsRes.count || 0,
    photos: photosRes.count || 0,
    customers: customersRes.count || 0,
    reports: reportsRes.count || 0,
    workers: workersRes.count || 0
  };
}

export function jobLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  return limitReached(limitsForPlan(plan).jobs, counts.jobs);
}

export function photoLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  return limitReached(limitsForPlan(plan).photos, counts.photos);
}

export function customerLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  return limitReached(limitsForPlan(plan).customers, counts.customers);
}

export function reportLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  const limits = limitsForPlan(plan);
  if (!limits.pdfReports) return true;
  return limitReached(limits.reports, counts.reports);
}

export function crewLimitReached(plan: EverittosPlan, workerCount: number): boolean {
  const limits = limitsForPlan(plan);
  if (!limits.crewAssignment) return true;
  return limitReached(limits.crewMembers, workerCount);
}

export function canAddTeamMember(plan: EverittosPlan, teamCount: number): boolean {
  return !limitReached(limitsForPlan(plan).teamMembers, teamCount);
}

export function usageLabels(plan: EverittosPlan, counts: UsageCounts) {
  const limits = limitsForPlan(plan);
  return {
    jobs: formatUsageLabel(counts.jobs, limits.jobs),
    photos: formatUsageLabel(counts.photos, limits.photos),
    customers: formatUsageLabel(counts.customers, limits.customers),
    reports: formatUsageLabel(counts.reports, limits.reports)
  };
}

export function limitMessage(resource: keyof PlanLimits, plan: EverittosPlan): string {
  const limits = limitsForPlan(plan);
  if (resource === 'jobs') return `Your plan allows up to ${limits.jobs} active jobs. Upgrade to continue.`;
  if (resource === 'photos') return `Your plan allows up to ${limits.photos} photos. Upgrade to continue.`;
  if (resource === 'customers') return `Your plan allows up to ${limits.customers} customers. Upgrade to continue.`;
  if (resource === 'reports') return `Your plan allows up to ${limits.reports} reports. Upgrade to continue.`;
  if (resource === 'crewMembers') return 'Crew assignment requires the Business plan.';
  if (resource === 'teamMembers') return 'Additional team members require the Business plan.';
  return 'Plan limit reached. Upgrade to continue.';
}
