'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { todayIso, daysAheadIso } from '@/lib/date-filters';
import { mapAccessError } from '@/lib/auth-errors';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { limitsForPlan } from '@/lib/everittos-limits';
import { billingUpgradeHref } from '@/lib/nav-access';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
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

type ActivityRow = {
  id: string;
  message: string | null;
  action: string;
  created_at: string | null;
  actor_name: string | null;
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
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [displayName, setDisplayName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [showNewJob, setShowNewJob] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
      .select('plan, role, full_name, business_name')
      .eq('id', user.id)
      .maybeSingle();
    const org = await ensureOrganizationForUser(user.id);
    const userPlan = normalizePlan(profile?.plan);
    setRole(normalizeRole(profile?.role));
    setDisplayName(profile?.full_name?.trim() || profile?.business_name?.trim() || '');
    setOrgId(org?.organizationId || '');
    setPlan(userPlan);

    if (isClientRole(normalizeRole(profile?.role))) {
      router.push('/portal/client');
      return;
    }

    let jobsQuery = scopeJobsForWorkspace(
      supabase.from('jobs').select('id, title, status, start_date, due_date').order('created_at', { ascending: false }),
      user.id,
      org?.organizationId
    );

    const customersQuery = org?.organizationId
      ? supabase
          .from('customers')
          .select(CUSTOMER_LIST_SELECT)
          .eq('organization_id', org.organizationId)
          .order('created_at', { ascending: false })
          .limit(5)
      : supabase
          .from('customers')
          .select(CUSTOMER_LIST_SELECT)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

    const activityQuery = org?.organizationId
      ? supabase
          .from('activity_logs')
          .select('id, message, action, created_at, actor_name')
          .eq('organization_id', org.organizationId)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null });

    const [jobsRes, customersRes, activityRes, orgIsDemo, calendarRes] = await Promise.all([
      jobsQuery,
      customersQuery,
      activityQuery,
      fetchOrganizationIsDemo(supabase, org?.organizationId),
      fetch('/api/integrations/google-calendar/status').then((r) => r.json()).catch(() => null)
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(filterDemoSeedJobs(jobsRes.data || [], orgIsDemo));
    setCustomers((customersRes.data || []) as CustomerRecord[]);
    setActivity((activityRes.data || []) as ActivityRow[]);
    setCalendarConnected(Boolean(calendarRes?.connected));
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

  function workersHref(): string {
    if (!limitsForPlan(plan).crewAssignment) {
      return billingUpgradeHref('business', t('dashboard.actions.workers'));
    }
    return '/workers';
  }

  const welcomeSubtitle = displayName
    ? t('dashboard.welcomeName', { name: displayName })
    : t('dashboard.subtitle');

  const coreActions = [
    { key: 'newJob', href: null, onClick: () => setShowNewJob(true), primary: true },
    { key: 'schedule', href: '/schedule', onClick: null, primary: false },
    { key: 'customers', href: '/customers', onClick: null, primary: false },
    { key: 'workers', href: workersHref(), onClick: null, primary: false },
    { key: 'billing', href: '/settings/billing', onClick: null, primary: false }
  ] as const;

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
          title={t('dashboard.title')}
          subtitle={welcomeSubtitle}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setShowNewJob((v) => !v)}>
              {t('dashboard.newJob')}
            </button>
          }
        />

        {calendarConnected !== null ? (
          <p className="muted dashboard-calendar-status">
            Google Calendar:{' '}
            {calendarConnected ? (
              <span className="status-pill status-pill-success">Connected</span>
            ) : (
              <>
                <span className="status-pill status-pill-muted">Not connected</span>{' '}
                <Link href="/settings/integrations">Connect in Settings</Link>
              </>
            )}
          </p>
        ) : null}

        <section aria-label={t('dashboard.primaryActions')}>
          <h2 className="section-heading">{t('dashboard.primaryActions')}</h2>
          <div className="quick-actions-grid">
            {coreActions.map((action) => {
              const label = t(`dashboard.actions.${action.key}`);
              if (action.onClick) {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={action.primary ? 'quick-action-tile quick-action-tile-primary' : 'quick-action-tile'}
                    onClick={action.onClick}
                  >
                    {label}
                  </button>
                );
              }
              return (
                <Link
                  key={action.key}
                  href={action.href || '/dashboard'}
                  className={action.primary ? 'quick-action-tile quick-action-tile-primary' : 'quick-action-tile'}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </section>

        {showNewJob ? (
          <section id="new-job" className="card dashboard-new-job-panel">
            <JobCreator
              onJobCreated={() => {
                setShowNewJob(false);
                void loadDashboard();
              }}
            />
          </section>
        ) : null}

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

        <section className="card dashboard-today-card" aria-label={t('dashboard.sidebar.upcoming')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.sidebar.upcoming')}</h2>
            <Link href="/schedule?range=upcoming" className="dashboard-section-link">
              {t('dashboard.sidebar.openSchedule')}
            </Link>
          </div>
          {!loading && upcomingJobs.length === 0 ? (
            <p className="dashboard-quiet-empty">No upcoming jobs in the next two weeks.</p>
          ) : null}
          {!loading &&
            upcomingJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="dashboard-today-row">
                <span>{job.title}</span>
                <span className="muted">{job.due_date || job.start_date}</span>
              </Link>
            ))}
        </section>

        <section className="card dashboard-today-card" aria-label={t('dashboard.sidebar.crmSnapshot')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.sidebar.crmSnapshot')}</h2>
            <Link href="/customers" className="dashboard-section-link">
              {t('dashboard.sidebar.openCrm')}
            </Link>
          </div>
          {!loading && customers.length === 0 ? (
            <p className="dashboard-quiet-empty">No customers yet. Add your first customer to get started.</p>
          ) : null}
          {!loading &&
            customers.map((customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`} className="dashboard-today-row">
                <span>{customerDisplayName(customer)}</span>
                <span className="muted">{customer.pipeline_stage || 'lead'}</span>
              </Link>
            ))}
        </section>

        <section className="card dashboard-today-card" aria-label={t('dashboard.recentActivity')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.recentActivity')}</h2>
            {orgId ? (
              <Link href="/activity" className="dashboard-section-link">
                {t('dashboard.viewActivity')}
              </Link>
            ) : null}
          </div>
          {!loading && activity.length === 0 ? (
            <p className="dashboard-quiet-empty">Activity will appear here as your team works.</p>
          ) : null}
          {!loading &&
            activity.map((row) => (
              <div key={row.id} className="dashboard-today-row">
                <span>{row.message || row.action}</span>
                <span className="muted">
                  {row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
        </section>
      </div>
    </AppShell>
  );
}
