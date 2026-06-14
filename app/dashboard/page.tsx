'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { DashboardBusinessActivity } from '@/components/dashboard-business-activity';
import { DashboardRevenueSnapshot } from '@/components/dashboard-revenue-snapshot';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { filterBusinessActivity, type ActivityLogRow } from '@/lib/business-activity';
import { fetchDashboardRevenueMetrics, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { mapAccessError } from '@/lib/auth-errors';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
};

function DashboardAccessNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const detail = searchParams.get('detail');
  if (!reason) return null;
  const mapped = mapAccessError(reason);
  return <AccessBlockedBanner title={mapped.title} message={mapped.message} details={detail || mapped.details} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<DashboardRevenueMetrics>({
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    jobsCompleted: 0,
    activeCustomers: 0
  });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalWorkers, setTotalWorkers] = useState(0);

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, role')
      .eq('id', user.id)
      .maybeSingle();
    const org = await ensureOrganizationForUser(user.id);
    const userPlan = normalizePlan(profile?.plan);
    setRole(normalizeRole(profile?.role));
    setOrgId(org?.organizationId || '');
    setPlan(userPlan);

    if (isClientRole(normalizeRole(profile?.role))) {
      router.push('/portal/client');
      return;
    }

    const jobsQuery = scopeJobsForWorkspace(
      supabase.from('jobs').select('id, title, status, start_date, due_date').order('created_at', { ascending: false }),
      user.id,
      org?.organizationId
    );

    const activityQuery = org?.organizationId
      ? supabase
          .from('activity_logs')
          .select('id, message, action, entity_type, entity_id, created_at, actor_name, metadata')
          .eq('organization_id', org.organizationId)
          .order('created_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [], error: null });

    const jobCountQuery = scopeJobsForWorkspace(
      supabase.from('jobs').select('id', { count: 'exact', head: true }),
      user.id,
      org?.organizationId
    );
    const customerCountQuery = org?.organizationId
      ? supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', org.organizationId)
      : supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    const workerCountQuery = org?.organizationId
      ? supabase.from('workers').select('id', { count: 'exact', head: true }).eq('organization_id', org.organizationId)
      : supabase.from('workers').select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    const metricsPromise = fetchDashboardRevenueMetrics(supabase, org?.organizationId || null);

    const [jobsRes, activityRes, orgIsDemo, jobCountRes, customerCountRes, workerCountRes, metrics] = await Promise.all([
      jobsQuery,
      activityQuery,
      fetchOrganizationIsDemo(supabase, org?.organizationId),
      jobCountQuery,
      customerCountQuery,
      workerCountQuery,
      metricsPromise
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    const filteredJobs = filterDemoSeedJobs((jobsRes.data || []) as Job[], orgIsDemo) as Job[];
    setActivity(filterBusinessActivity((activityRes.data || []) as ActivityLogRow[]).slice(0, 6));
    setRevenueMetrics(metrics);
    setTotalJobs(orgIsDemo ? filteredJobs.length : jobCountRes.count || 0);
    setTotalCustomers(customerCountRes.count || 0);
    setTotalWorkers(workerCountRes.count || 0);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const setupItems = [
    {
      label: 'Add first customer',
      detail: 'Store customer details and job history.',
      href: '/customers/new',
      done: totalCustomers > 0
    },
    {
      label: 'Create first job',
      detail: 'Schedule and track your first service.',
      href: '/jobs/new',
      done: totalJobs > 0
    },
    {
      label: 'Invite worker',
      detail: 'Assign work to your team or contractors.',
      href: '/workers',
      done: totalWorkers > 0
    },
    {
      label: 'Connect calendar',
      detail: 'Review scheduling and calendar settings.',
      href: '/settings',
      done: false
    }
  ];
  const setupComplete = setupItems.filter((item) => item.done).length;
  const showSetup = !loading && setupComplete < setupItems.length;
  const showActivityLink = limitsForPlan(plan).activityLog && Boolean(orgId);

  const focusItems = loading
    ? [{ title: 'Loading your workspace', detail: 'Checking customers, jobs and activity.', href: '/dashboard' }]
    : totalCustomers === 0 || totalJobs === 0
      ? [
          { title: 'Add your first customer', detail: 'Start with the person or company you serve.', href: '/customers/new' },
          { title: 'Create your first job', detail: 'Track the work, date and status in one place.', href: '/jobs/new' },
          { title: 'Use Ask Everitt', detail: 'Ask what needs attention once your data is in.', href: '/dashboard' }
        ]
      : [
          { title: `${totalJobs} job${totalJobs === 1 ? '' : 's'} in your workspace`, detail: 'Open jobs to review work status.', href: '/jobs' },
          { title: `${totalCustomers} customer${totalCustomers === 1 ? '' : 's'} tracked`, detail: 'Review customers and recent work.', href: '/customers' },
          { title: 'Review schedule', detail: 'Check what is booked or needs follow-up.', href: '/schedule' }
        ];

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense>
        <DashboardAccessNotice />
      </Suspense>

      {errorMessage ? (
        <p className="auth-message auth-message-error" role="alert">
          {friendlyErrorMessage(errorMessage)}
        </p>
      ) : null}

      <div className="today-page dashboard-home">
        <PageHeader
          title={t('dashboard.welcome')}
          subtitle="Manage customers, jobs, schedule, workers, invoices and business performance."
        />

        <section className="card dashboard-actions-card" aria-label={t('dashboard.primaryActions')}>
          <div className="dashboard-section-head">
            <h2>Quick actions</h2>
          </div>
          <div className="dashboard-action-row">
            <Link href="/customers/new">New customer</Link>
            <Link href="/jobs/new">New job</Link>
            <Link href="/schedule/new">Schedule</Link>
            <Link href="/invoices">Invoice</Link>
            <Link href="/workers">Worker</Link>
          </div>
        </section>

        <section className="card dashboard-focus-card" aria-label="Today&apos;s focus">
          <div className="dashboard-section-head">
            <h2>Today&apos;s focus</h2>
          </div>
          <div className="dashboard-focus-list">
            {focusItems.map((item) => (
              <Link key={item.title} href={item.href} className="dashboard-focus-item">
                <span>{item.title}</span>
                <small>{item.detail}</small>
              </Link>
            ))}
          </div>
        </section>

        {showSetup ? (
          <section className="card dashboard-start-card" aria-label="Get your business set up">
            <div className="dashboard-start-copy">
              <p className="dashboard-eyebrow">Start here</p>
              <h2>Get your business set up</h2>
              <p>Complete these first steps so EverittOS can start tracking your work clearly.</p>
            </div>
            <div className="dashboard-start-progress" aria-label={`${setupComplete} of ${setupItems.length} setup steps complete`}>
              <span>
                {setupComplete} of {setupItems.length} complete
              </span>
              <div className="dashboard-progress-track">
                <span style={{ width: `${(setupComplete / setupItems.length) * 100}%` }} />
              </div>
            </div>
            <div className="dashboard-start-list">
              {setupItems.map((item) => (
                <Link key={item.label} href={item.href} className="dashboard-start-item">
                  <span className={item.done ? 'dashboard-check dashboard-check-done' : 'dashboard-check'}>
                    {item.done ? '✓' : ''}
                  </span>
                  <span className="dashboard-start-item-copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <DashboardRevenueSnapshot metrics={revenueMetrics} loading={loading} />

        <DashboardBusinessActivity items={activity} loading={loading} showViewAll={showActivityLink} />

        <section className="dashboard-help-strip" aria-label="Need help setting up EverittOS">
          <div>
            <h2>Need help setting up?</h2>
            <p>Book a free onboarding call and we will help set up customers, jobs, workers, scheduling and invoicing.</p>
          </div>
          <Link href="/support" className="dashboard-help-link">
            Book free call
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
