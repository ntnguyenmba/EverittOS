'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { DashboardBusinessActivity } from '@/components/dashboard-business-activity';
import { DashboardRevenueSnapshot } from '@/components/dashboard-revenue-snapshot';
import { OnboardingSupportPromo } from '@/components/onboarding-support-promo';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { filterBusinessActivity, type ActivityLogRow } from '@/lib/business-activity';
import { fetchDashboardRevenueMetrics, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { todayIso, daysAheadIso } from '@/lib/date-filters';
import { mapAccessError } from '@/lib/auth-errors';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
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
  return (
    <AccessBlockedBanner title={mapped.title} message={mapped.message} details={detail || mapped.details} />
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [leads, setLeads] = useState<CustomerRecord[]>([]);
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

    const customersQuery = org?.organizationId
      ? supabase
          .from('customers')
          .select(CUSTOMER_LIST_SELECT)
          .eq('organization_id', org.organizationId)
          .not('pipeline_stage', 'in', '("lead","qualified")')
          .order('created_at', { ascending: false })
          .limit(5)
      : supabase
          .from('customers')
          .select(CUSTOMER_LIST_SELECT)
          .eq('user_id', user.id)
          .not('pipeline_stage', 'in', '("lead","qualified")')
          .order('created_at', { ascending: false })
          .limit(5);

    const leadsQuery = org?.organizationId
      ? supabase
          .from('customers')
          .select(CUSTOMER_LIST_SELECT)
          .eq('organization_id', org.organizationId)
          .in('pipeline_stage', ['lead', 'qualified'])
          .order('created_at', { ascending: false })
          .limit(5)
      : supabase
          .from('customers')
          .select(CUSTOMER_LIST_SELECT)
          .eq('user_id', user.id)
          .in('pipeline_stage', ['lead', 'qualified'])
          .order('created_at', { ascending: false })
          .limit(5);

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

    const [jobsRes, customersRes, leadsRes, activityRes, orgIsDemo, jobCountRes, customerCountRes, workerCountRes, metrics] =
      await Promise.all([
        jobsQuery,
        customersQuery,
        leadsQuery,
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
    setJobs(filteredJobs);
    setCustomers((customersRes.data || []) as CustomerRecord[]);
    setLeads((leadsRes.data || []) as CustomerRecord[]);
    setActivity(filterBusinessActivity((activityRes.data || []) as ActivityLogRow[]).slice(0, 8));
    setRevenueMetrics(metrics);
    setTotalJobs(orgIsDemo ? filteredJobs.length : jobCountRes.count || 0);
    setTotalCustomers(customerCountRes.count || 0);
    setTotalWorkers(workerCountRes.count || 0);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const today = todayIso();
  const upcomingEnd = daysAheadIso(14);

  const todayJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status !== 'cancelled' && (j.start_date === today || j.due_date === today))
        .slice(0, 8),
    [jobs, today]
  );

  const upcomingJobs = useMemo(
    () =>
      jobs
        .filter((j) => {
          if (j.status === 'cancelled' || j.status === 'completed') return false;
          const date = j.due_date || j.start_date;
          return date && date >= today && date <= upcomingEnd;
        })
        .sort((a, b) => (a.due_date || a.start_date || '').localeCompare(b.due_date || b.start_date || ''))
        .slice(0, 8),
    [jobs, today, upcomingEnd]
  );

  const showSetupSupportCard = !loading && (totalCustomers === 0 || totalJobs === 0 || totalWorkers === 0);
  const showActivityLink = limitsForPlan(plan).activityLog && Boolean(orgId);

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

      <div className="today-page">
        <PageHeader
          title={t('dashboard.welcome')}
          subtitle={t('dashboard.subtitle')}
          action={
            <Link className="btn btn-primary" href="/jobs/new">
              {t('dashboard.newJob')}
            </Link>
          }
        />

        <section className="card dashboard-today-card" aria-label={t('dashboard.todaysSchedule')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.todaysSchedule')}</h2>
            <Link href="/schedule" className="dashboard-section-link">
              {t('dashboard.viewSchedule')}
            </Link>
          </div>
          {loading ? <p className="loading-state" role="status">{t('common.loading')}</p> : null}
          {!loading && todayJobs.length === 0 ? (
            <p className="dashboard-quiet-empty">{t('dashboard.noScheduleToday')}</p>
          ) : null}
          {!loading &&
            todayJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="dashboard-today-row">
                <span>{job.title}</span>
                <span className="muted">{job.due_date || job.start_date}</span>
              </Link>
            ))}
        </section>

        <section className="card dashboard-today-card" aria-label={t('dashboard.upcomingJobs')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.upcomingJobs')}</h2>
            <Link href="/schedule?range=upcoming" className="dashboard-section-link">
              {t('dashboard.sidebar.openSchedule')}
            </Link>
          </div>
          {!loading && upcomingJobs.length === 0 ? (
            <p className="dashboard-quiet-empty">{t('dashboard.noUpcomingJobs')}</p>
          ) : null}
          {!loading &&
            upcomingJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="dashboard-today-row">
                <span>{job.title}</span>
                <span className="muted">{job.due_date || job.start_date}</span>
              </Link>
            ))}
        </section>

        <section className="card dashboard-today-card" aria-label={t('dashboard.customersAndLeads')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.customersAndLeads')}</h2>
            <div className="dashboard-section-links">
              <Link href="/customers" className="dashboard-section-link">
                {t('nav.customers')}
              </Link>
              <Link href="/leads" className="dashboard-section-link">
                {t('nav.leads')}
              </Link>
            </div>
          </div>
          {!loading && customers.length === 0 && leads.length === 0 ? (
            <p className="dashboard-quiet-empty">{t('dashboard.noCustomersOrLeads')}</p>
          ) : null}
          {!loading &&
            customers.map((customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`} className="dashboard-today-row">
                <span>{customerDisplayName(customer)}</span>
                <span className="muted">{customer.pipeline_stage || 'customer'}</span>
              </Link>
            ))}
          {!loading &&
            leads.map((lead) => (
              <Link key={lead.id} href={`/customers/${lead.id}`} className="dashboard-today-row">
                <span>{customerDisplayName(lead)}</span>
                <span className="muted">{lead.lead_source || 'lead'}</span>
              </Link>
            ))}
        </section>

        <DashboardRevenueSnapshot metrics={revenueMetrics} loading={loading} />

        <DashboardBusinessActivity items={activity} loading={loading} showViewAll={showActivityLink} />

        {showSetupSupportCard ? <OnboardingSupportPromo variant="dashboard" /> : null}
      </div>
    </AppShell>
  );
}
