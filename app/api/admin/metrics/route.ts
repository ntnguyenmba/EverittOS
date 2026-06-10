import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

const PLAN_MRR: Record<string, number> = {
  pro: 9,
  business: 39,
  operations: 149,
  growth: 399,
  enterprise: 799
};

function isPlatformAdmin(email: string | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration incomplete.' }, { status: 503 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    orgs,
    users,
    jobs,
    customers,
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

  const activeSubscriptionsByPlan: Record<string, number> = {};
  let mrrEstimate = 0;
  let trialingCount = 0;

  (subs.data || []).forEach((s) => {
    if (s.status === 'active' || String(s.status).startsWith('everittos_')) {
      activeSubscriptionsByPlan[s.plan] = (activeSubscriptionsByPlan[s.plan] || 0) + 1;
      mrrEstimate += PLAN_MRR[s.plan] || 0;
    }
    if (s.status === 'trialing') trialingCount += 1;
  });

  return NextResponse.json({
    totalCompanies: orgs.count || 0,
    totalUsers: users.count || 0,
    totalJobs: jobs.count || 0,
    activeJobs: activeJobs.count || 0,
    totalCustomers: customers.count || 0,
    totalReports: reports.count || 0,
    totalPhotos: photos.count || 0,
    totalTeamMembers: teamMembers || 0,
    activeSubscriptionsByPlan,
    mrrEstimateUsd: mrrEstimate,
    trialingAccounts: trialingCount,
    freeAccounts: freeAccounts.count || 0,
    pastDueAccounts: pastDue.count || 0,
    latestSignups: profiles.data || [],
    newestOrganizations: newestOrgs.data || [],
    last30Days: {
      productEvents: events.data?.length || 0,
      signupsTracked: signups30d,
      jobsCreatedTracked: jobsCreated30d
    }
  });
}
