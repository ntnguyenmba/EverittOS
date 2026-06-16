import { normalizePlan } from '@/lib/everittos-plans';
import { createAdminSupabase } from '@/lib/supabase-admin';

const PLAN_MRR: Record<string, number> = {
  pro: 9,
  business: 39,
  growth: 399,
  enterprise: 799
};

export type PlatformMetrics = {
  totalCompanies: number;
  totalUsers: number;
  activeCustomers: number;
  totalJobs: number;
  activeJobs: number;
  endCustomers: number;
  totalReports: number;
  totalPhotos: number;
  totalTeamMembers: number;
  activeOrganizations: number;
  activeSubscriptionsByPlan: Record<string, number>;
  mrrEstimateUsd: number;
  arrEstimateUsd: number;
  trialingAccounts: number;
  freeAccounts: number;
  pastDueAccounts: number;
  churnRatePct: number;
  trialConversionRatePct: number;
  averageRevenuePerAccountUsd: number;
  averageUsersPerOrganization: number;
  monthlyGrowthPct: number;
  retentionRatePct: number;
  latestSignups: { id: string; email: string | null; plan: string | null; created_at: string | null }[];
  newestOrganizations: { id: string; name: string; created_at: string | null }[];
  last30Days: {
    productEvents: number;
    signupsTracked: number;
    jobsCreatedTracked: number;
    onboardingEventsTracked: number;
  };
};

export async function fetchPlatformMetrics(): Promise<PlatformMetrics | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    orgs,
    users,
    jobs,
    endCustomers,
    reports,
    photos,
    subs,
    events,
    profiles,
    pastDue,
    freeAccounts,
    newestOrgs
  ] = await Promise.all([
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('jobs').select('id', { count: 'exact', head: true }),
    admin.from('customers').select('id', { count: 'exact', head: true }),
    admin.from('job_reports').select('id', { count: 'exact', head: true }),
    admin.from('job_photos').select('id', { count: 'exact', head: true }),
    admin.from('everittos_subscriptions').select('plan, status, email'),
    admin.from('product_events').select('event_name, created_at').gte('created_at', thirtyDaysAgo),
    admin.from('profiles').select('id, email, plan, subscription_status, created_at').order('created_at', { ascending: false }).limit(10),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_status', 'past_due'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', 'free'),
    admin.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }).limit(8)
  ]);

  const { count: teamMembers } = await admin.from('organization_members').select('id', { count: 'exact', head: true });

  const activeJobs = await admin
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .not('status', 'eq', 'completed')
    .not('status', 'eq', 'cancelled');

  const signups30d = (events.data || []).filter((e) => e.event_name === 'signup').length;
  const jobsCreated30d = (events.data || []).filter((e) => e.event_name === 'job_created').length;
  const onboardingCompleted30d = (events.data || []).filter((e) => e.event_name === 'onboarding_step').length;

  const activeSubscriptionsByPlan: Record<string, number> = {};
  let mrrEstimate = 0;
  let trialingCount = 0;
  let activeCustomerCount = 0;
  let canceledCount = 0;

  (subs.data || []).forEach((s) => {
    if (s.status === 'active' || String(s.status).startsWith('everittos_')) {
      activeSubscriptionsByPlan[s.plan] = (activeSubscriptionsByPlan[s.plan] || 0) + 1;
      mrrEstimate += PLAN_MRR[normalizePlan(s.plan)] || 0;
      activeCustomerCount += 1;
    }
    if (s.status === 'trialing') trialingCount += 1;
    if (s.status === 'canceled') canceledCount += 1;
  });

  const totalUsers = users.count || 0;
  const totalOrgs = orgs.count || 0;
  const avgUsersPerOrganization = totalOrgs > 0 ? Math.round(((teamMembers || 0) / totalOrgs) * 10) / 10 : 0;
  const arpa = activeCustomerCount > 0 ? Math.round(mrrEstimate / activeCustomerCount) : 0;
  const trialConversionRate =
    trialingCount + activeCustomerCount > 0
      ? Math.round((activeCustomerCount / (trialingCount + activeCustomerCount)) * 100)
      : 0;
  const churnRate =
    activeCustomerCount + canceledCount > 0
      ? Math.round((canceledCount / (activeCustomerCount + canceledCount)) * 100)
      : 0;
  const monthlyGrowth = totalOrgs > 0 ? Math.round(((newestOrgs.data?.length || 0) / totalOrgs) * 100) : 0;
  const retentionRate = Math.max(0, 100 - churnRate);

  return {
    totalCompanies: totalOrgs,
    totalUsers,
    activeCustomers: activeCustomerCount,
    totalJobs: jobs.count || 0,
    activeJobs: activeJobs.count || 0,
    endCustomers: endCustomers.count || 0,
    totalReports: reports.count || 0,
    totalPhotos: photos.count || 0,
    totalTeamMembers: teamMembers || 0,
    activeOrganizations: totalOrgs,
    activeSubscriptionsByPlan,
    mrrEstimateUsd: mrrEstimate,
    arrEstimateUsd: mrrEstimate * 12,
    trialingAccounts: trialingCount,
    freeAccounts: freeAccounts.count || 0,
    pastDueAccounts: pastDue.count || 0,
    churnRatePct: churnRate,
    trialConversionRatePct: trialConversionRate,
    averageRevenuePerAccountUsd: arpa,
    averageUsersPerOrganization: avgUsersPerOrganization,
    monthlyGrowthPct: monthlyGrowth,
    retentionRatePct: retentionRate,
    latestSignups: profiles.data || [],
    newestOrganizations: newestOrgs.data || [],
    last30Days: {
      productEvents: events.data?.length || 0,
      signupsTracked: signups30d,
      jobsCreatedTracked: jobsCreated30d,
      onboardingEventsTracked: onboardingCompleted30d
    }
  };
}

export function platformMetricsToCsv(metrics: PlatformMetrics): string {
  const rows: string[][] = [
    ['metric', 'value'],
    ['mrr_usd', String(metrics.mrrEstimateUsd)],
    ['arr_usd', String(metrics.arrEstimateUsd)],
    ['total_companies', String(metrics.totalCompanies)],
    ['total_users', String(metrics.totalUsers)],
    ['active_customers', String(metrics.activeCustomers)],
    ['churn_rate_pct', String(metrics.churnRatePct)],
    ['trial_conversion_rate_pct', String(metrics.trialConversionRatePct)],
    ['average_revenue_per_account_usd', String(metrics.averageRevenuePerAccountUsd)],
    ['average_users_per_organization', String(metrics.averageUsersPerOrganization)],
    ['monthly_growth_pct', String(metrics.monthlyGrowthPct)],
    ['retention_rate_pct', String(metrics.retentionRatePct)],
    ['active_jobs', String(metrics.activeJobs)],
    ['total_jobs', String(metrics.totalJobs)],
    ['free_accounts', String(metrics.freeAccounts)],
    ['past_due_accounts', String(metrics.pastDueAccounts)],
    ['trialing_accounts', String(metrics.trialingAccounts)]
  ];

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}
