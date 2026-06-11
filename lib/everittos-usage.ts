import { supabase } from '@/lib/supabase';
import { limitsForPlan, type PlanLimits } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { formatUsageLabel, limitReached } from '@/lib/plan-limit-utils';
import { validatePlanAction } from '@/lib/plan-validate';

export type UsageCounts = {
  jobs: number;
  photos: number;
  customers: number;
  reports: number;
  workers: number;
  teamMembers: number;
  locations: number;
};

export async function fetchUsageCounts(userId: string, organizationId?: string | null): Promise<UsageCounts> {
  const jobFilter = organizationId
    ? supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    : supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId);

  const photoFilter = organizationId
    ? supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    : supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId);

  const customerFilter = organizationId
    ? supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    : supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', userId);

  const reportFilter = organizationId
    ? supabase.from('job_reports').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    : supabase.from('job_reports').select('id', { count: 'exact', head: true }).eq('user_id', userId);

  const workerFilter = organizationId
    ? supabase.from('workers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
    : supabase.from('workers').select('id', { count: 'exact', head: true }).eq('user_id', userId);

  const [jobsRes, photosRes, customersRes, reportsRes, workersRes, teamRes, locRes] = await Promise.all([
    jobFilter.not('status', 'eq', 'cancelled'),
    photoFilter,
    customerFilter,
    reportFilter,
    workerFilter,
    organizationId
      ? supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('active', true)
      : Promise.resolve({ count: 1 }),
    organizationId
      ? supabase
          .from('organization_locations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
      : Promise.resolve({ count: 0 })
  ]);

  return {
    jobs: jobsRes.count || 0,
    photos: photosRes.count || 0,
    customers: customersRes.count || 0,
    reports: reportsRes.count || 0,
    workers: workersRes.count || 0,
    teamMembers: teamRes.count || 1,
    locations: locRes.count || 0
  };
}

export function jobLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  return !validatePlanAction({ plan, resource: 'jobs', currentCount: counts.jobs }).allowed;
}

export function photoLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  return !validatePlanAction({ plan, resource: 'photos', currentCount: counts.photos }).allowed;
}

export function customerLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  return !validatePlanAction({ plan, resource: 'customers', currentCount: counts.customers }).allowed;
}

export function reportLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  const limits = limitsForPlan(plan);
  if (!limits.pdfReports) return true;
  return !validatePlanAction({ plan, resource: 'reports', currentCount: counts.reports }).allowed;
}

export function crewLimitReached(plan: EverittosPlan, workerCount: number): boolean {
  return !validatePlanAction({ plan, resource: 'workers', currentCount: workerCount }).allowed;
}

export function canAddTeamMember(plan: EverittosPlan, teamCount: number): boolean {
  return validatePlanAction({ plan, resource: 'teamMembers', currentCount: teamCount }).allowed;
}

export function usageLabels(plan: EverittosPlan, counts: UsageCounts) {
  const limits = limitsForPlan(plan);
  return {
    jobs: formatUsageLabel(counts.jobs, limits.jobs),
    photos: formatUsageLabel(counts.photos, limits.photos),
    customers: formatUsageLabel(counts.customers, limits.customers),
    reports: formatUsageLabel(counts.reports, limits.reports),
    team: formatUsageLabel(counts.teamMembers, limits.teamMembers)
  };
}

export function limitMessage(resource: keyof PlanLimits, plan: EverittosPlan): string {
  const limits = limitsForPlan(plan);
  if (resource === 'jobs') return `Your plan allows up to ${limits.jobs} active jobs. Upgrade to continue.`;
  if (resource === 'photos') {
    if (!limits.photoUpload) return 'Upgrade to Pro to upload photos.';
    return `Your plan allows up to ${limits.photos} photos. Upgrade to continue.`;
  }
  if (resource === 'customers') return `Your plan allows up to ${limits.customers} customers. Upgrade to continue.`;
  if (resource === 'reports') return `Your plan allows up to ${limits.reports} reports. Upgrade to continue.`;
  if (resource === 'crewMembers') return 'Crew workers require Business, Operations, Growth, or Enterprise.';
  if (resource === 'teamMembers') return 'Additional team members require a plan with team management.';
  return 'Plan limit reached. Upgrade to continue.';
}
