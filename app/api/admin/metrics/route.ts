import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

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

  const [
    orgs,
    users,
    jobs,
    customers,
    reports,
    photos,
    subs,
    events
  ] = await Promise.all([
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('jobs').select('id', { count: 'exact', head: true }),
    admin.from('customers').select('id', { count: 'exact', head: true }),
    admin.from('job_reports').select('id', { count: 'exact', head: true }),
    admin.from('job_photos').select('id', { count: 'exact', head: true }),
    admin.from('everittos_subscriptions').select('plan, status'),
    admin.from('product_events').select('event_name').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
  ]);

  const activeJobs = await admin
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .not('status', 'eq', 'completed')
    .not('status', 'eq', 'cancelled');

  const signups30d = (events.data || []).filter((e) => e.event_name === 'signup').length;
  const jobsCreated30d = (events.data || []).filter((e) => e.event_name === 'job_created').length;

  const revenueByPlan: Record<string, number> = {};
  (subs.data || []).forEach((s) => {
    if (s.status === 'active') {
      revenueByPlan[s.plan] = (revenueByPlan[s.plan] || 0) + 1;
    }
  });

  return NextResponse.json({
    totalCompanies: orgs.count || 0,
    totalUsers: users.count || 0,
    totalJobs: jobs.count || 0,
    activeJobs: activeJobs.count || 0,
    totalCustomers: customers.count || 0,
    totalReports: reports.count || 0,
    totalPhotos: photos.count || 0,
    activeSubscriptionsByPlan: revenueByPlan,
    last30Days: {
      productEvents: events.data?.length || 0,
      signupsTracked: signups30d,
      jobsCreatedTracked: jobsCreated30d
    }
  });
}
