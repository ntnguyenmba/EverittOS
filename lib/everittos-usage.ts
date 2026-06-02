import { supabase } from '@/lib/supabase';
import { limitsForPlan, type PlanLimits } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';

export type UsageCounts = {
  jobs: number;
  photos: number;
  customers: number;
};

export async function fetchUsageCounts(userId: string): Promise<UsageCounts> {
  const [jobsRes, photosRes, customersRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('status', 'eq', 'cancelled'),
    supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);

  return {
    jobs: jobsRes.count || 0,
    photos: photosRes.count || 0,
    customers: customersRes.count || 0
  };
}

export function jobLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  const limits = limitsForPlan(plan);
  return limits.jobs > 0 && counts.jobs >= limits.jobs;
}

export function photoLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  const limits = limitsForPlan(plan);
  return limits.photos > 0 && counts.photos >= limits.photos;
}

export function customerLimitReached(plan: EverittosPlan, counts: UsageCounts): boolean {
  const limits = limitsForPlan(plan);
  return limits.customers > 0 && counts.customers >= limits.customers;
}

export function crewLimitReached(plan: EverittosPlan, workerCount: number): boolean {
  const limits = limitsForPlan(plan);
  return limits.crewMembers > 0 && workerCount >= limits.crewMembers;
}

export function limitMessage(resource: keyof PlanLimits, plan: EverittosPlan): string {
  const limits = limitsForPlan(plan);
  if (resource === 'jobs') return `Free plan allows up to ${limits.jobs} active jobs. Upgrade to Pro for more.`;
  if (resource === 'photos') return `Your plan allows up to ${limits.photos} photos. Upgrade for more storage.`;
  if (resource === 'customers') return `Your plan allows up to ${limits.customers} customers. Upgrade for more.`;
  if (resource === 'crewMembers') return `Your plan allows up to ${limits.crewMembers} workers. Upgrade for more.`;
  return 'Plan limit reached. Upgrade to continue.';
}
